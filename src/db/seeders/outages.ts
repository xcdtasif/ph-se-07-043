import { prisma } from "../../lib/prisma.js"
import { logCount } from "../utils/log-count.js"

const HOUR_MS = 60 * 60 * 1000

/*
A confirmed outage in Dhanmondi, which links Customer 04's pending report. Mirpur's reports stay
pending, so its Zone Manager has something to confirm
*/
const OUTAGE = {
  areaNames: ["Dhanmondi Road 27", "Dhanmondi Road 32"],
  hoursAgo: 4,
  note: "Fault near Road 27, crews are on the way",
}

// Seeded once: running the seed again leaves existing outages alone
export const seedOutages = async () => {
  if ((await prisma.outage.count()) > 0) {
    logCount(0, "outage", "outages", "seeded")

    return
  }

  const areas = await prisma.area.findMany({
    where: { name: { in: OUTAGE.areaNames }, deletedAt: null },
    select: { id: true, feeder: { select: { zoneId: true } } },
  })
  const zoneId = areas[0]?.feeder.zoneId
  const manager =
    zoneId &&
    (await prisma.employee.findFirst({
      where: { role: "ZONE_MANAGER", zoneId, endedAt: null },
      select: { userId: true },
    }))

  if (!zoneId || !manager) {
    logCount(0, "outage", "outages", "seeded")

    return
  }

  const areaIds = areas.map((area) => area.id)
  const confirmedAt = new Date(Date.now() - OUTAGE.hoursAgo * HOUR_MS)

  await prisma.$transaction(async (tx) => {
    const outage = await tx.outage.create({
      data: {
        zoneId,
        note: OUTAGE.note,
        confirmedById: manager.userId,
        confirmedAt,
        updatedAt: confirmedAt,
        areas: { createMany: { data: areaIds.map((areaId) => ({ areaId })) } },
      },
      select: { id: true },
    })

    await tx.outageReport.updateMany({
      where: { areaId: { in: areaIds }, status: "PENDING" },
      data: { status: "LINKED", outageId: outage.id, updatedAt: confirmedAt },
    })
  })

  logCount(1, "outage", "outages", "seeded")
}
