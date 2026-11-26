import { prisma } from "../../lib/prisma.js"

/*
What every authenticated request and auth response knows about the user: the login and the
active employee profile (Customer joins this in step 8). Password and googleId never leave here
*/
export const authUserSelect = {
  id: true,
  name: true,
  email: true,
  isBanned: true,
  tokenVersion: true,
  employees: {
    where: { endedAt: null },
    select: { id: true, role: true, zoneId: true },
  },
} as const

type SelectedUser = NonNullable<Awaited<ReturnType<typeof findAuthUser>>>

export const findAuthUser = (where: { id: string } | { email: string }) =>
  prisma.user.findUnique({ where, select: authUserSelect })

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
