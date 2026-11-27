import z from "zod"

import { OutageCause, OutageStatus } from "../../generated/prisma/enums.js"

/*
The outage covers the given areas plus the areas of the given reports, so a Zone Manager can
confirm straight from the reports they're looking at. Every pending report in those areas is linked
*/
export const confirmOutageSchema = z
  .strictObject({
    areaIds: z.array(z.uuid()).max(50).optional(),
    reportIds: z.array(z.uuid()).max(50).optional(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    // Zod still runs this when a field failed, passing that field's raw input
    ({ areaIds, reportIds }) =>
      [areaIds, reportIds].some((ids) => Array.isArray(ids) && ids.length > 0),
    { error: "Send areaIds, reportIds or both" },
  )

export type ConfirmOutagePayload = z.output<typeof confirmOutageSchema>

const pageSchema = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(OutageStatus).optional(),
}

export const outagesQuerySchema = z.strictObject({
  ...pageSchema,
  zoneId: z.uuid().optional(),
  areaId: z.uuid().optional(),
})

export type OutagesQuery = z.output<typeof outagesQuerySchema>

export const assignedOutagesQuerySchema = z.strictObject(pageSchema)

export type AssignedOutagesQuery = z.output<typeof assignedOutagesQuerySchema>

// The employee id of a technician in the Zone Manager's zone, from GET /employees
export const assignOutageSchema = z.strictObject({
  technicianId: z.uuid(),
})

export type AssignOutagePayload = z.output<typeof assignOutageSchema>

// The service checks the move from the current status and whether the cause is known
export const updateOutageStatusSchema = z.strictObject({
  status: z.enum(["IN_PROGRESS", "RESTORED"]),
  cause: z.enum(OutageCause).optional(),
})

export type UpdateOutageStatusPayload = z.output<typeof updateOutageStatusSchema>
