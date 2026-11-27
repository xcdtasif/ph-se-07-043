import httpStatus from "http-status"
import Stripe from "stripe"

type MappedError = {
  statusCode: number
  message: string
}

// Stripe's own errors as client answers; what Stripe said stays in the server log
export const handleStripeError = (err: unknown): MappedError | null => {
  if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
    return { statusCode: httpStatus.BAD_REQUEST, message: "Invalid webhook signature" }
  }

  if (err instanceof Stripe.errors.StripeRateLimitError) {
    return {
      statusCode: httpStatus.TOO_MANY_REQUESTS,
      message: "Payment provider is busy, try again",
    }
  }

  if (err instanceof Stripe.errors.StripeConnectionError) {
    return { statusCode: httpStatus.SERVICE_UNAVAILABLE, message: "Payment provider unavailable" }
  }

  if (err instanceof Stripe.errors.StripeError) {
    return { statusCode: httpStatus.BAD_GATEWAY, message: "Payment provider error" }
  }

  return null
}
