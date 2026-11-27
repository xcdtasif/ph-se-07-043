import z from "zod"

import { dhakaDate } from "../../utils/dhaka-time.js"
import { slotWindowIssues } from "./schedule.rules.js"

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
