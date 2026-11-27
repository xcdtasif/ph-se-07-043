import z from "zod"

import { dateSchema } from "../../utils/date-schema.js"
import { dhakaDate, shiftDate } from "../../utils/dhaka-time.js"

export const ANALYTICS_DEFAULT_DAYS = 30
export const ANALYTICS_MAX_DAYS = 366

/*
A range of Dhaka days, both included; the default is the last 30 ending today. A Zone Manager
gets their own zone; an admin one zone, or the whole company without zoneId
*/
export const outageAnalyticsQuerySchema = z
  .strictObject({
    zoneId: z.uuid().optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .transform(({ to = dhakaDate(), from, ...filter }) => ({
    ...filter,
    from: from ?? shiftDate(to, -(ANALYTICS_DEFAULT_DAYS - 1)),
    to,
  }))
  .refine(({ from, to }) => to >= from && to <= shiftDate(from, ANALYTICS_MAX_DAYS - 1), {
    path: ["to"],
    error: `Must be on or after from, and at most ${ANALYTICS_MAX_DAYS} days in all`,
  })

export type OutageAnalyticsQuery = z.output<typeof outageAnalyticsQuerySchema>
