import httpStatus from "http-status"

import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"

export const customerSelect = { id: true, areaId: true, meterNumber: true } as const

/*
What every authenticated request and auth response knows about the user: the login, the customer
profile and the active employee profile. Password and googleId never leave here
*/
export const authUserSelect = {
  id: true,
  name: true,
  email: true,
  isBanned: true,
  tokenVersion: true,
  customer: { select: customerSelect },
  employees: {
    where: { endedAt: null },
    select: { id: true, role: true, zoneId: true },
  },
} as const

type SelectedUser = NonNullable<Awaited<ReturnType<typeof findAuthUser>>>

export const findAuthUser = (where: { id: string } | { email: string }) =>
  prisma.user.findUnique({ where, select: authUserSelect })

/*
The user a verified access or refresh token belongs to, if that session is still valid. Logout and
password changes bump tokenVersion, which ends every session issued before them
*/
export const findSessionUser = async ({
  userId,
  tokenVersion,
}: {
  userId: string
  tokenVersion: number
}) => {
  const user = await findAuthUser({ id: userId })

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Account not found, please log in again")
  }

  if (user.tokenVersion !== tokenVersion) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Session ended, please log in again")
  }

  if (user.isBanned) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account has been banned")
  }

  return user
}

// At most one active employee row per user (partial unique index), so it's flattened
export const toAuthUser = ({ employees, ...user }: SelectedUser) => ({
  ...user,
  employee: employees[0] ?? null,
})

export type AuthUser = ReturnType<typeof toAuthUser>

// The user as sent to the client
export const publicUser = ({
  tokenVersion: _tokenVersion,
  isBanned: _isBanned,
  ...user
}: AuthUser) => user
