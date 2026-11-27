import express, { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { validate } from "../../middlewares/validate.js"
import { paymentController } from "./payment.controller.js"
import { myPaymentsQuerySchema } from "./payment.schema.js"

const router = Router()

// Get My Payments
router.get(
  "/me",
  authenticate,
  validate(myPaymentsQuerySchema, "query"),
  paymentController.getMyPayments,
)

export const paymentRouter = router

const webhookRouter = Router()

// Stripe Webhook; the signature is checked against the raw body, so it isn't parsed as JSON
webhookRouter.post("/", express.raw({ type: "application/json" }), paymentController.handleWebhook)

export const stripeWebhookRouter = webhookRouter
