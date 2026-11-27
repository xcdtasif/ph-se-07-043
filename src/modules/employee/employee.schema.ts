import z from "zod"

import { EmployeeRole } from "../../generated/prisma/enums.js"

// A Zone Manager always gets their zone's technicians, so role and zoneId only narrow an admin's list
export const employeeListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  role: z.enum(EmployeeRole).optional(),
  zoneId: z.uuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
})

export type EmployeeListQuery = z.output<typeof employeeListQuerySchema>
