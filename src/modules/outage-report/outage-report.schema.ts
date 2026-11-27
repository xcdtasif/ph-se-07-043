import z from "zod"

import { OutageReportStatus } from "../../generated/prisma/enums.js"

// The area comes from the customer's profile, so the body only describes what happened
export const createReportSchema = z.strictObject({
  description: z.string().trim().min(1).max(500).optional(),
})

export type CreateReportPayload = z.output<typeof createReportSchema>

const pageSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(OutageReportStatus).optional(),
}

export const myReportsQuerySchema = z.strictObject(pageSchema)

export type MyReportsQuery = z.output<typeof myReportsQuerySchema>

export const zoneReportsQuerySchema = z.strictObject({
  ...pageSchema,
  areaId: z.uuid().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export type ZoneReportsQuery = z.output<typeof zoneReportsQuerySchema>

export const dismissReportSchema = z.strictObject({
  reason: z.string().trim().min(3).max(500),
})

export type DismissReportPayload = z.output<typeof dismissReportSchema>
