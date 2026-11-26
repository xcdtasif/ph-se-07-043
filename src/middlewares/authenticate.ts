import type { RequestHandler } from "express"
import httpStatus from "http-status"

import { findSessionUser, toAuthUser } from "../modules/auth/auth.user.js"
import { authUtils } from "../modules/auth/auth.utils.js"
import { AppError } from "../utils/app-error.js"

export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? []

  if (scheme !== "Bearer" || !token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
  }

  const user = await findSessionUser(authUtils.verifyAccessToken(token))

  req.user = toAuthUser(user)

  next()
}
