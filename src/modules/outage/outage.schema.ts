import z from "zod"

import { OutageStatus } from "../../generated/prisma/enums.js"

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

export const outagesQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(OutageStatus).optional(),
  zoneId: z.uuid().optional(),
  areaId: z.uuid().optional(),
})

export type OutagesQuery = z.output<typeof outagesQuerySchema>
