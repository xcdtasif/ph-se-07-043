// Bangladesh has no daylight saving time, so Asia/Dhaka is always UTC+6
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// The Dhaka calendar date (YYYY-MM-DD) at an instant, `days` days later
export const dhakaDate = (days = 0, now = new Date()) =>
  new Date(now.getTime() + DHAKA_OFFSET_MS + days * DAY_MS).toISOString().slice(0, 10)

// The instant a Dhaka wall-clock time happens, e.g. dhakaTime("2026-11-28", 9) for 9 AM
export const dhakaTime = (date: string, hour: number, minute = 0) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - DHAKA_OFFSET_MS + (hour * 60 + minute) * 60 * 1000)

// The instants a Dhaka calendar day starts at (inclusive) and ends at (exclusive)
export const dhakaDayRange = (date: string) => {
  const start = dhakaTime(date, 0)

  return { start, end: new Date(start.getTime() + DAY_MS) }
}

// A calendar date (YYYY-MM-DD) `days` days later, e.g. shiftDate("2026-11-28", 6) is 2026-12-04
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

// A timestamp filter for the Dhaka days `from` to `to`, both included; either end may be open
export const dhakaDaysFilter = (from?: string, to?: string) => ({
  ...(from && { gte: dhakaDayRange(from).start }),
  ...(to && { lt: dhakaDayRange(to).end }),
})
