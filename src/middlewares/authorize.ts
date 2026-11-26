import type { RequestHandler } from "express"
import httpStatus from "http-status"

import type { EmployeeRole } from "../generated/prisma/enums.js"
import { AppError } from "../utils/app-error.js"

// Use after authenticate. Passes when the user's active employee role is one of roles
export const authorize =
  (...roles: EmployeeRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
    }

    const role = req.user.employee?.role

    if (!role || !roles.includes(role)) {
      throw new AppError(httpStatus.FORBIDDEN, "You don't have permission to do this")
    }

    next()
  }
