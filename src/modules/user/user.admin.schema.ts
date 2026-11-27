import z from "zod"

import { EmployeeRole } from "../../generated/prisma/enums.js"

// CUSTOMER means has a customer profile; the others mean that active employee role
export const USER_ROLE_FILTERS = ["CUSTOMER", ...Object.values(EmployeeRole)] as const

export const userListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  role: z.enum(USER_ROLE_FILTERS).optional(),
  isBanned: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sortBy: z.enum(["name", "email", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export type UserListQuery = z.output<typeof userListQuerySchema>

export const userIdParamsSchema = z.strictObject({
  id: z.uuid(),
})

export type UserIdParams = z.output<typeof userIdParamsSchema>

export const banUserSchema = z.strictObject({
  isBanned: z.boolean(),
})

export type BanUserPayload = z.output<typeof banUserSchema>
