import { Router } from "express"

import { validate } from "../../middlewares/validate.js"
import { authController } from "./auth.controller.js"
import { registerUserSchema, verifyEmailSchema } from "./auth.schema.js"

const router = Router()

// Register User
router.post("/register", validate(registerUserSchema, "body"), authController.registerUser)

// Verify Email
router.post("/verify-email", validate(verifyEmailSchema, "body"), authController.verifyEmail)

export const authRouter = router
