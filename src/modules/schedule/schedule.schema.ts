import z from "zod"

import { dhakaDate, shiftDate } from "../../utils/dhaka-time.js"
import { SCHEDULE_MAX_DAYS, slotWindowIssues } from "./schedule.rules.js"

// An instant with its offset, e.g. 2026-11-28T09:00:00+06:00 or 2026-11-28T03:00:00Z
const instantSchema = z.iso
  .datetime({ offset: true, error: "Use an ISO date-time like 2026-11-28T09:00:00+06:00" })
  .transform((value) => new Date(value))

export const createSlotSchema = z
  .strictObject({
    feederId: z.uuid(),
    startsAt: instantSchema,
    endsAt: instantSchema,
  })
  .superRefine(({ startsAt, endsAt }, ctx) => {
    // Zod still runs this when a field failed, passing that field's raw input
    if (!(startsAt instanceof Date && endsAt instanceof Date)) return

    for (const { path, message } of slotWindowIssues(startsAt, endsAt)) {
      ctx.addIssue({ code: "custom", path: [path], message })
    }
  })

export type CreateSlotPayload = z.output<typeof createSlotSchema>

// The service checks the merged window, since one time alone can't be judged
export const updateSlotSchema = z
  .strictObject({
    startsAt: instantSchema.optional(),
    endsAt: instantSchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Send startsAt, endsAt or both",
  })

export type UpdateSlotPayload = z.output<typeof updateSlotSchema>

export const confirmDaySchema = z.strictObject({
  // A Dhaka calendar date; past days can't be confirmed
  date: z.iso
    .date({ error: "Use a date like 2026-11-28" })
    .refine((date) => date >= dhakaDate(), { error: "Must be today or later (Dhaka time)" }),
})

export type ConfirmDayPayload = z.output<typeof confirmDaySchema>

const dateSchema = z.iso.date({ error: "Use a date like 2026-11-28" })

/*
One feeder filter, and a range of Dhaka days: today alone is `from=<today>&to=<today>`, and the
default is the week ahead from today
*/
export const scheduleQuerySchema = z
  .strictObject({
    areaId: z.uuid().optional(),
    feederId: z.uuid().optional(),
    zoneId: z.uuid().optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine(({ areaId, feederId, zoneId }, ctx) => {
    if ([areaId, feederId, zoneId].filter(Boolean).length !== 1) {
      ctx.addIssue({ code: "custom", path: [], message: "Send one of areaId, feederId or zoneId" })
    }
  })
  .transform(({ from = dhakaDate(), to, ...filter }) => ({
    ...filter,
    from,
    to: to ?? shiftDate(from, SCHEDULE_MAX_DAYS - 1),
  }))
  .refine(({ from, to }) => to >= from && to <= shiftDate(from, SCHEDULE_MAX_DAYS - 1), {
    path: ["to"],
    error: `Must be on or after from, and at most ${SCHEDULE_MAX_DAYS} days in all`,
  })

export type ScheduleQuery = z.output<typeof scheduleQuerySchema>
