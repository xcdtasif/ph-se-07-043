import type { RequestHandler } from "express"
import httpStatus from "http-status"

import { findAuthUser, toAuthUser } from "../modules/auth/auth.user.js"
import { authUtils } from "../modules/auth/auth.utils.js"
import { AppError } from "../utils/app-error.js"

export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? []

  if (scheme !== "Bearer" || !token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
  }

  const { userId, tokenVersion } = authUtils.verifyAccessToken(token)

  const user = await findAuthUser({ id: userId })

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Account not found, please log in again")
  }

  // The user logged out or reset their password after this token was issued
  if (user.tokenVersion !== tokenVersion) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Session ended, please log in again")
  }

  if (user.isBanned) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account has been banned")
  }

  req.user = toAuthUser(user)

  next()
}
