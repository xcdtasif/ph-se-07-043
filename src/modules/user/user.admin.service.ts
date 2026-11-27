import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { customerSelect } from "../auth/auth.user.js"
import type { BanUserPayload, UserListQuery } from "./user.admin.schema.js"

// The user object plus what an admin needs to manage the account
const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  isBanned: true,
  createdAt: true,
  customer: { select: customerSelect },
  employees: {
    where: { endedAt: null },
    select: { id: true, role: true, zoneId: true },
  },
} as const

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>

const toAdminUser = ({ employees, ...user }: AdminUserRow) => ({
  ...user,
  employee: employees[0] ?? null,
})

const getAllUsers = async (query: UserListQuery) => {
  const { page, limit, search, role, isBanned, sortBy, sortOrder } = query

  const where: Prisma.UserWhereInput = {
    ...(role === "CUSTOMER" && { customer: { isNot: null } }),
    ...(role && role !== "CUSTOMER" && { employees: { some: { role, endedAt: null } } }),
    ...(isBanned !== undefined && { isBanned }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      // The id keeps users with equal sort values in the same order on every page
      orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return { users: users.map(toAdminUser), meta: { page, limit, total } }
}

const banUser = async (adminId: string, userId: string, { isBanned }: BanUserPayload) => {
  if (userId === adminId) {
    throw new AppError(httpStatus.BAD_REQUEST, "You can't ban yourself")
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { employees: { where: { endedAt: null }, select: { role: true } } },
    })

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found")
    }

    if (user.employees[0]?.role === "ADMIN") {
      throw new AppError(httpStatus.FORBIDDEN, "Admins can't be banned")
    }

    /*
    Conditional on the current state, so two admins acting at once can't both succeed. Banning
    bumps tokenVersion: an unban later doesn't bring back sessions from before the ban
    */
    const { count } = await tx.user.updateMany({
      where: { id: userId, isBanned: !isBanned },
      data: { isBanned, ...(isBanned && { tokenVersion: { increment: 1 } }) },
    })

    if (count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        isBanned ? "User is already banned" : "User isn't banned",
      )
    }

    await writeAuditLog(tx, {
      actorId: adminId,
      action: isBanned ? "USER_BANNED" : "USER_UNBANNED",
      entityType: "USER",
      entityId: userId,
      before: { isBanned: !isBanned },
      after: { isBanned },
    })

    return toAdminUser(
      await tx.user.findUniqueOrThrow({ where: { id: userId }, select: adminUserSelect }),
    )
  })
}

export const adminUserService = { getAllUsers, banUser }
