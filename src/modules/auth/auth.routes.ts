import { Router } from "express"

import { byIpAndEmail, rateLimit } from "../../middlewares/rate-limit.js"
import { validate } from "../../middlewares/validate.js"
import { verifyTurnstile } from "../../middlewares/verify-turnstile.js"
import { authController } from "./auth.controller.js"
import { loginUserSchema, registerUserSchema, verifyEmailSchema } from "./auth.schema.js"

const router = Router()

/*
Rate limits run first (cheapest check), then the bot check, then validation.
Each register sends an email, so it gets the tightest limit
*/

// Register User
router.post(
  "/register",
  rateLimit({ prefix: "register", limit: 5, window: "1 h", key: byIpAndEmail }),
  verifyTurnstile,
  validate(registerUserSchema, "body"),
  authController.registerUser,
)

// Verify Email
router.post(
  "/verify-email",
  rateLimit({ prefix: "verify-email", limit: 10, window: "10 m", key: byIpAndEmail }),
  validate(verifyEmailSchema, "body"),
  authController.verifyEmail,
)

// Log In User
router.post(
  "/login",
  rateLimit({ prefix: "login", limit: 10, window: "15 m", key: byIpAndEmail }),
  verifyTurnstile,
  validate(loginUserSchema, "body"),
  authController.loginUser,
)

export const authRouter = router
