import { randomUUID } from "node:crypto"

import type { ApplicationStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { toInvoiceNumber } from "../../modules/payment/payment.invoice.js"
import { logCount } from "../utils/log-count.js"
import { uploadSampleCv } from "../utils/sample-cv.js"

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

type SeedApplication = {
  email: string
  postingTitle: string
  status: ApplicationStatus
  // In order; a COMPLETED one submits the application. No PENDING: that's a live Stripe session
  payments: ("FAILED" | "COMPLETED")[]
  appliedDaysAgo: number
}

/*
Customer 01, the demo applicant, has one application waiting for the fee (after a failed payment),
one submitted, one shortlisted and one rejected; hiring would make them an employee, so Technician
03 holds the hired one. Zone Manager 01 has Mirpur's Line Technician applications to review, and
Admin 01 the Uttara Zone Manager ones
*/
const APPLICATIONS: SeedApplication[] = [
  {
    email: "customer01@example.com",
    postingTitle: "Cable Jointer, Dhanmondi",
    status: "PAYMENT_PENDING",
    payments: ["FAILED"],
    appliedDaysAgo: 1,
  },
  {
    email: "customer01@example.com",
    postingTitle: "Line Technician, Mirpur",
    status: "SUBMITTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 2,
  },
  {
    email: "customer01@example.com",
    postingTitle: "Zone Manager, Uttara",
    status: "SHORTLISTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 1,
  },
  {
    email: "customer01@example.com",
    postingTitle: "Meter Technician, Mirpur",
    status: "REJECTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 30,
  },
  {
    email: "technician03@example.com",
    postingTitle: "Substation Technician, Mirpur",
    status: "HIRED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 15,
  },
  {
    email: "customer02@example.com",
    postingTitle: "Line Technician, Mirpur",
    status: "SHORTLISTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 2,
  },
  {
    email: "customer03@example.com",
    postingTitle: "Line Technician, Mirpur",
    status: "SUBMITTED",
    payments: ["FAILED", "COMPLETED"],
    appliedDaysAgo: 1,
  },
  {
    email: "customer07@example.com",
    postingTitle: "Line Technician, Mirpur",
    status: "REJECTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 2,
  },
  {
    email: "customer08@example.com",
    postingTitle: "Line Technician, Mirpur",
    status: "PAYMENT_PENDING",
    payments: [],
    appliedDaysAgo: 1,
  },
  {
    email: "customer04@example.com",
    postingTitle: "Cable Jointer, Dhanmondi",
    status: "SUBMITTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 3,
  },
  {
    email: "customer06@example.com",
    postingTitle: "Zone Manager, Uttara",
    status: "SUBMITTED",
    payments: ["COMPLETED"],
    appliedDaysAgo: 1,
  },
]

const REVIEWED: ApplicationStatus[] = ["SHORTLISTED", "REJECTED", "HIRED"]

// Fake session ids: nothing asks Stripe about a payment that isn't PENDING
const toPayments = (fee: number, appliedAt: Date, statuses: SeedApplication["payments"]) =>
  statuses.map((status, index) => {
    const id = randomUUID()
    const createdAt = new Date(appliedAt.getTime() + (index + 1) * MINUTE_MS)
    const paidAt = status === "COMPLETED" ? new Date(createdAt.getTime() + 2 * MINUTE_MS) : null

    return {
      id,
      amount: fee,
      status,
      stripeSessionId: `cs_seed_${id}`,
      paidAt,
      invoiceNumber: paidAt && toInvoiceNumber(id, paidAt),
      createdAt,
      updatedAt: paidAt ?? createdAt,
    }
  })

// Safe to run again: an application whose user already applied for that posting is skipped
export const seedApplications = async () => {
  const [users, postings, existing] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: APPLICATIONS.map((seed) => seed.email) } },
      select: { id: true, email: true },
    }),
    prisma.jobPosting.findMany({
      where: { title: { in: APPLICATIONS.map((seed) => seed.postingTitle) }, deletedAt: null },
      select: { id: true, title: true, applicationFee: true, createdById: true },
    }),
    prisma.application.findMany({ select: { jobPostingId: true, userId: true } }),
  ])
  const userIds = new Map(users.map((user) => [user.email, user.id]))
  const postingsByTitle = new Map(postings.map((posting) => [posting.title, posting]))
  const applied = new Set(existing.map((row) => `${row.jobPostingId}:${row.userId}`))

  const missing = APPLICATIONS.flatMap((seed) => {
    const userId = userIds.get(seed.email)
    const posting = postingsByTitle.get(seed.postingTitle)

    return userId && posting && !applied.has(`${posting.id}:${userId}`)
      ? [{ ...seed, userId, posting }]
      : []
  })

  if (missing.length === 0) {
    logCount(0, "application", "applications", "seeded")
    return
  }

  const cv = await uploadSampleCv()

  for (const { userId, posting, status, payments, appliedDaysAgo } of missing) {
    const appliedAt = new Date(Date.now() - appliedDaysAgo * DAY_MS)

    await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          jobPostingId: posting.id,
          userId,
          phone: "01712345678",
          cvUrl: cv.url,
          cvPublicId: cv.publicId,
          status,
          // The posting's poster made the decision
          reviewedById: REVIEWED.includes(status) ? posting.createdById : null,
          createdAt: appliedAt,
          updatedAt: appliedAt,
          payments: { create: toPayments(posting.applicationFee, appliedAt, payments) },
        },
        select: { id: true },
      })

      // The hire links the applicant's employee row, which the technician seed created
      if (status === "HIRED") {
        await tx.employee.updateMany({
          where: { userId, endedAt: null, applicationId: null },
          data: { applicationId: application.id },
        })
      }
    })
  }

  logCount(missing.length, "application", "applications", "seeded")
}
