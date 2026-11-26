import { Router } from "express"

import { validate } from "../../middlewares/validate.js"
import { authController } from "./auth.controller.js"
import { loginUserSchema, registerUserSchema, verifyEmailSchema } from "./auth.schema.js"

const router = Router()

// Register User
router.post("/register", validate(registerUserSchema, "body"), authController.registerUser)

// Verify Email
router.post("/verify-email", validate(verifyEmailSchema, "body"), authController.verifyEmail)

// Log In User
router.post("/login", validate(loginUserSchema, "body"), authController.loginUser)

export const authRouter = router
