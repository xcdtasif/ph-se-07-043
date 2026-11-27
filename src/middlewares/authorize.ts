import type { RequestHandler } from "express"
import httpStatus from "http-status"

import type { EmployeeRole } from "../generated/prisma/enums.js"
import { AppError } from "../utils/app-error.js"

type Role = EmployeeRole | "CUSTOMER"

/*
Use after authenticate. Passes when the user's active employee role is one of roles, or when
"CUSTOMER" is one of them and the user has a customer profile
*/
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
    }

    const { employee, customer } = req.user
    const isCustomer = roles.includes("CUSTOMER") && customer !== null
    const isEmployee = employee !== null && roles.includes(employee.role)

    if (!isCustomer && !isEmployee) {
      // A customer-only route is missing the profile, which the user can fix themselves
      const customerOnly = roles.length === 1 && roles[0] === "CUSTOMER"

      throw new AppError(
        httpStatus.FORBIDDEN,
        customerOnly
          ? "Create your customer profile first"
          : "You don't have permission to do this",
      )
    }

    next()
  }
