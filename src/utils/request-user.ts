import type { Request } from "express"
import httpStatus from "http-status"

import { AppError } from "./app-error.js"

// The user authenticate attached; only for handlers behind authenticate
export const requestUser = (req: Request<any, any, any, any>) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
  }

  return req.user
}
