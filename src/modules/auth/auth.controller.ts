import type { Request, Response } from "express"
import httpStatus from "http-status"

import { sendResponse } from "../../utils/send-response.js"
import type { LoginUserPayload, RegisterUserPayload, VerifyEmailPayload } from "./auth.schema.js"
import { authService } from "./auth.service.js"

const registerUser = async (req: Request<{}, {}, RegisterUserPayload>, res: Response) => {
  const result = await authService.registerUser(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Verification code sent to your email",
    data: result,
  })
}

const verifyEmail = async (req: Request<{}, {}, VerifyEmailPayload>, res: Response) => {
  const result = await authService.verifyEmail(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Email verified, account created",
    data: result,
  })
}

const loginUser = async (req: Request<{}, {}, LoginUserPayload>, res: Response) => {
  const result = await authService.loginUser(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Logged in successfully",
    data: result,
  })
}

export const authController = { registerUser, verifyEmail, loginUser }
