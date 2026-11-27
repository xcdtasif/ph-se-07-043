import type { ErrorItem } from "../../utils/app-error.js"

const MINUTE_MS = 60 * 1000

export const SLOT_MIN_MINUTES = 15
export const SLOT_MAX_HOURS = 12
export const SLOT_HORIZON_DAYS = 30
// The most Dhaka days one public read can cover: a week's forecast
export const SCHEDULE_MAX_DAYS = 7

/*
What's wrong with a slot's times, as validation errors. Used by the create schema and by the
update service, which only knows the full window after merging the change with the stored slot
*/
export const slotWindowIssues = (startsAt: Date, endsAt: Date, now = new Date()): ErrorItem[] => {
  const issues: ErrorItem[] = []
  const minutes = (endsAt.getTime() - startsAt.getTime()) / MINUTE_MS

  if (startsAt <= now) {
    issues.push({ path: "startsAt", message: "Must be in the future" })
  } else if (startsAt.getTime() > now.getTime() + SLOT_HORIZON_DAYS * 24 * 60 * MINUTE_MS) {
    issues.push({ path: "startsAt", message: `Must be within ${SLOT_HORIZON_DAYS} days` })
  }

  if (minutes < SLOT_MIN_MINUTES || minutes > SLOT_MAX_HOURS * 60) {
    issues.push({
      path: "endsAt",
      message: `Must be ${SLOT_MIN_MINUTES} minutes to ${SLOT_MAX_HOURS} hours after startsAt`,
    })
  }

  return issues
}
