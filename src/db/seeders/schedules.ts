import type { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { dhakaDate, dhakaTime } from "../../utils/dhaka-time.js"
import { logCount } from "../utils/log-count.js"

// Each feeder loses power twice a day for 2 hours; feeders take turns so a zone isn't all dark
const SLOT_HOURS = [8, 18]
const SLOT_LENGTH_HOURS = 2

// Yesterday through 6 days ahead, in Dhaka days. Days up to today are confirmed, later ones tentative
const FIRST_DAY = -1
const LAST_DAY = 6

/*
Slots for the zones that have a Zone Manager, created by that manager. Dates are relative to the
day the seed runs, so the demo always has a past day, today and a week ahead. One of tomorrow's
slots is cancelled to show that status
*/
export const seedSchedules = async () => {
  const managers = await prisma.employee.findMany({
    where: { role: "ZONE_MANAGER", endedAt: null, zoneId: { not: null } },
    select: {
      userId: true,
      zoneId: true,
      zone: {
        select: {
          feeders: { where: { deletedAt: null }, select: { id: true }, orderBy: { code: "asc" } },
        },
      },
    },
  })

  const slots: Prisma.LoadSheddingSlotCreateManyInput[] = []

  for (const { userId, zone } of managers) {
    const feeders = zone?.feeders ?? []
    const feederIds = feeders.map((feeder) => feeder.id)

    if (feederIds.length === 0) continue

    // Seeded once per zone: running the seed again leaves the schedule alone
    const existing = await prisma.loadSheddingSlot.count({
      where: { feederId: { in: feederIds } },
    })

    if (existing > 0) continue

    for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
      const date = dhakaDate(day)

      feederIds.forEach((feederId, index) => {
        for (const [slotIndex, hour] of SLOT_HOURS.entries()) {
          const startHour = hour + index * SLOT_LENGTH_HOURS
          const cancelled = day === 1 && index === 0 && slotIndex === 1

          slots.push({
            feederId,
            startsAt: dhakaTime(date, startHour),
            endsAt: dhakaTime(date, startHour + SLOT_LENGTH_HOURS),
            status: cancelled ? "CANCELLED" : day <= 0 ? "CONFIRMED" : "TENTATIVE",
            createdById: userId,
          })
        }
      })
    }
  }

  const { count } = await prisma.loadSheddingSlot.createMany({ data: slots })

  logCount(count, "load shedding slot", "load shedding slots", "seeded")
}
