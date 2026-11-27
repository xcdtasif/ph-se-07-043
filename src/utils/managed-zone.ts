import httpStatus from "http-status"

import type { AuthUser } from "../modules/auth/auth.user.js"
import { AppError } from "./app-error.js"

// The Zone Manager's zone. authorize("ZONE_MANAGER") runs first, and a Zone Manager always has one
export const managedZoneId = (user: AuthUser) => {
  const zoneId = user.employee?.zoneId

  if (!zoneId) {
    throw new AppError(httpStatus.FORBIDDEN, "You don't have permission to do this")
  }

  return zoneId
}
