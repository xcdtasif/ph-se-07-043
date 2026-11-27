import express, { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { paymentController } from "./payment.controller.js"
import { adminPaymentsQuerySchema, myPaymentsQuerySchema } from "./payment.schema.js"

const router = Router()

// Get My Payments
router.get(
  "/me",
  authenticate,
  validate(myPaymentsQuerySchema, "query"),
  paymentController.getMyPayments,
)

// Download Invoice
router.get(
  "/:id/invoice",
  authenticate,
  validate(idParamsSchema, "params"),
  paymentController.getInvoice,
)

export const paymentRouter = router

const adminRouter = Router()

// Get All Payments
adminRouter.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(adminPaymentsQuerySchema, "query"),
  paymentController.getAllPayments,
)

export const adminPaymentRouter = adminRouter

const webhookRouter = Router()

// Stripe Webhook; the signature is checked against the raw body, so it isn't parsed as JSON
webhookRouter.post("/", express.raw({ type: "application/json" }), paymentController.handleWebhook)

export const stripeWebhookRouter = webhookRouter
