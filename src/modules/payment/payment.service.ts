import httpStatus from "http-status"
import type Stripe from "stripe"

import { env } from "../../config/env.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { prisma } from "../../lib/prisma.js"
import { stripe } from "../../lib/stripe.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { AuthUser } from "../auth/auth.user.js"
import { isOpenPosting } from "../job-posting/job-posting.service.js"
import type { MyPaymentsQuery } from "./payment.schema.js"

const CURRENCY = "bdt"

// Stripe needs a Checkout session to live at least 30 minutes
const CHECKOUT_EXPIRES_IN_SECONDS = 35 * 60

/*
A PENDING payment younger than a session's lifetime has a checkout that may still be paid. Going by
its age, not its status alone, keeps a missed "expired" webhook from blocking payment for good
*/
const activeCheckoutWhere = (applicationId: string): Prisma.PaymentWhereInput => ({
  applicationId,
  status: "PENDING",
  createdAt: { gt: new Date(Date.now() - CHECKOUT_EXPIRES_IN_SECONDS * 1000) },
})

// The session and intent ids stay on the server; the success page finds a payment by session_id
const paymentSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  application: {
    select: {
      id: true,
      status: true,
      jobPosting: {
        select: {
          id: true,
          title: true,
          role: true,
          zone: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
} as const

/*
Opens a Checkout session for the application's fee, or hands back the one still open, so a user
who closed the tab has one payable session. The application row is locked meanwhile, so a double
click waits and then reuses the session too
*/
const createCheckout = async (user: AuthUser, applicationId: string) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      userId: true,
      jobPostingId: true,
      jobPosting: { select: { title: true, applicationFee: true } },
    },
  })

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found")
  }

  if (application.userId !== user.id) {
    throw new AppError(httpStatus.FORBIDDEN, "This application isn't yours")
  }

  const { title, applicationFee } = application.jobPosting
  const description = `Application fee: ${title}`

  // Sessions made inside the transaction, expired again if it fails
  const createdSessionIds: string[] = []

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Locks the row until commit; nothing changes if it isn't waiting for payment
        const { count } = await tx.application.updateMany({
          where: { id: applicationId, status: "PAYMENT_PENDING" },
          data: { status: "PAYMENT_PENDING" },
        })

        if (count === 0) {
          throw new AppError(httpStatus.CONFLICT, "This application's fee is already paid")
        }

        // Closing the posting waits for this; paying after it closed would be a late application
        if (!(await lockLiveRow(tx, "job_postings", application.jobPostingId, "SHARE"))) {
          throw new AppError(httpStatus.CONFLICT, "This job posting is closed")
        }

        const posting = await tx.jobPosting.findUniqueOrThrow({
          where: { id: application.jobPostingId },
          select: { status: true, deadline: true },
        })

        if (!isOpenPosting(posting)) {
          throw new AppError(httpStatus.CONFLICT, "This job posting is closed")
        }

        const active = await tx.payment.findFirst({
          where: activeCheckoutWhere(applicationId),
          select: { ...paymentSelect, stripeSessionId: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })

        if (active) {
          const { stripeSessionId, ...payment } = active
          const session = await stripe.checkout.sessions.retrieve(stripeSessionId)

          if (session.status === "open" && session.url) {
            return { ...payment, checkoutUrl: session.url }
          }

          // Paid, and the webhook hasn't submitted the application yet; a new session would be payable too
          if (session.status === "complete") {
            throw new AppError(httpStatus.CONFLICT, "Your payment is being processed")
          }
        }

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: CURRENCY,
                // In poisha
                unit_amount: applicationFee * 100,
                product: env.STRIPE_PRODUCT_ID,
              },
            },
          ],
          customer_email: user.email,
          custom_text: { submit: { message: description } },
          payment_intent_data: { description },
          client_reference_id: applicationId,
          metadata: { applicationId },
          expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRES_IN_SECONDS,
          success_url: `${env.CLIENT_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${env.CLIENT_URL}/payments/cancel`,
        })

        createdSessionIds.push(session.id)

        if (!session.url) {
          throw new AppError(httpStatus.BAD_GATEWAY, "Couldn't create a checkout session")
        }

        const payment = await tx.payment.create({
          data: {
            applicationId,
            amount: applicationFee,
            currency: CURRENCY,
            stripeSessionId: session.id,
          },
          select: paymentSelect,
        })

        return { ...payment, checkoutUrl: session.url }
      },
      // Covers the Stripe calls made while the application row is locked
      { timeout: 30_000 },
    )
  } catch (err) {
    // Nobody should be able to pay a session with no payment behind it
    await Promise.all(
      createdSessionIds.map((id) => stripe.checkout.sessions.expire(id).catch(() => undefined)),
    )

    throw err
  }
}

/*
Marks the payment COMPLETED and submits the application, in one transaction with its audit log.
Stripe retries webhooks, so a payment that's no longer PENDING is skipped
*/
const completePayment = async (session: Stripe.Checkout.Session) => {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { stripeSessionId: session.id },
      select: { id: true, applicationId: true },
    })

    if (!payment) {
      return
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null)
    const paidAt = new Date()

    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "COMPLETED", paymentIntentId, paidAt },
    })

    if (count === 0) {
      return
    }

    await writeAuditLog(tx, {
      actorId: null,
      action: "PAYMENT_COMPLETED",
      entityType: "PAYMENT",
      entityId: payment.id,
      before: { status: "PENDING" },
      after: { status: "COMPLETED", paidAt: paidAt.toISOString() },
    })

    const { count: submitted } = await tx.application.updateMany({
      where: { id: payment.applicationId, status: "PAYMENT_PENDING" },
      data: { status: "SUBMITTED" },
    })

    // Two sessions both paid; the second needs a refund, which isn't built yet (plan step 27)
    if (submitted === 0) {
      console.error(
        `Payment ${payment.id} was paid but application ${payment.applicationId} was already paid`,
      )
    }
  })
}

// An expired session leaves the application waiting for payment, so the user can pay again
const failPayment = async (session: Stripe.Checkout.Session) => {
  await prisma.payment.updateMany({
    where: { stripeSessionId: session.id, status: "PENDING" },
    data: { status: "FAILED" },
  })
}

const handleWebhook = async (rawBody: Buffer, signature: string) => {
  // Throws a signature error, which the error handler turns into a 400
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)

  if (event.type === "checkout.session.completed") {
    if (event.data.object.payment_status === "paid") {
      await completePayment(event.data.object)
    }
  } else if (event.type === "checkout.session.expired") {
    await failPayment(event.data.object)
  }
}

const getMyPayments = async (user: AuthUser, query: MyPaymentsQuery) => {
  const { page, limit, status, sessionId } = query

  const where: Prisma.PaymentWhereInput = {
    application: { userId: user.id },
    ...(status && { status }),
    ...(sessionId && { stripeSessionId: sessionId }),
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: paymentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ])

  return { payments, meta: { page, limit, total } }
}

export const paymentService = { createCheckout, handleWebhook, getMyPayments }
