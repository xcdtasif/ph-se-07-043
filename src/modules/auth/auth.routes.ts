import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { byIpAndEmail, rateLimit } from "../../middlewares/rate-limit.js"
import { validate } from "../../middlewares/validate.js"
import { verifyTurnstile } from "../../middlewares/verify-turnstile.js"
import { authController } from "./auth.controller.js"
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleLoginSchema,
  loginUserSchema,
  refreshTokenSchema,
  registerUserSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schema.js"

const router = Router()

/*
Rate limits run first (cheapest check), then the bot check, then validation.
Register and forgot password send an email, so they get the tightest limit
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

// Google Login (Google's own sign-in stands in for the bot check)
router.post(
  "/google",
  rateLimit({ prefix: "google", limit: 20, window: "15 m" }),
  validate(googleLoginSchema, "body"),
  authController.googleLogin,
)

// Refresh Tokens
router.post("/refresh-token", validate(refreshTokenSchema, "body"), authController.refreshTokens)

// Log Out User
router.post("/logout", authenticate, authController.logoutUser)

// Forgot Password
router.post(
  "/forgot-password",
  rateLimit({ prefix: "forgot-password", limit: 5, window: "1 h", key: byIpAndEmail }),
  verifyTurnstile,
  validate(forgotPasswordSchema, "body"),
  authController.forgotPassword,
)

// Reset Password
router.post(
  "/reset-password",
  rateLimit({ prefix: "reset-password", limit: 10, window: "10 m", key: byIpAndEmail }),
  validate(resetPasswordSchema, "body"),
  authController.resetPassword,
)

// Change Password
router.patch(
  "/change-password",
  rateLimit({ prefix: "change-password", limit: 10, window: "15 m" }),
  authenticate,
  validate(changePasswordSchema, "body"),
  authController.changePassword,
)

export const authRouter = router
