import type { Request, Response } from "express"
import httpStatus from "http-status"

import { AppError } from "../../utils/app-error.js"
import { sendResponse } from "../../utils/send-response.js"
import type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  GoogleLoginPayload,
  LoginUserPayload,
  RefreshTokenPayload,
  RegisterUserPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from "./auth.schema.js"
import { authService } from "./auth.service.js"

const getUserId = (req: Request<any, any, any, any>) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
  }

  return req.user.id
}

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

const googleLogin = async (req: Request<{}, {}, GoogleLoginPayload>, res: Response) => {
  const result = await authService.googleLogin(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Logged in with Google successfully",
    data: result,
  })
}

const refreshTokens = async (req: Request<{}, {}, RefreshTokenPayload>, res: Response) => {
  const result = await authService.refreshTokens(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Tokens refreshed successfully",
    data: result,
  })
}

const logoutUser = async (req: Request, res: Response) => {
  await authService.logoutUser(getUserId(req))

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Logged out successfully",
  })
}

const forgotPassword = async (req: Request<{}, {}, ForgotPasswordPayload>, res: Response) => {
  const result = await authService.forgotPassword(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "If an account uses this email, a reset code was sent to it",
    data: result,
  })
}

const resetPassword = async (req: Request<{}, {}, ResetPasswordPayload>, res: Response) => {
  await authService.resetPassword(req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Password reset, log in with the new password",
  })
}

const changePassword = async (req: Request<{}, {}, ChangePasswordPayload>, res: Response) => {
  const result = await authService.changePassword(getUserId(req), req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Password changed successfully",
    data: result,
  })
}

export const authController = {
  registerUser,
  verifyEmail,
  loginUser,
  googleLogin,
  refreshTokens,
  logoutUser,
  forgotPassword,
  resetPassword,
  changePassword,
}
