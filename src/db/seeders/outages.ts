import type { OutageCause } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { logCount } from "../utils/log-count.js"

const HOUR_MS = 60 * 60 * 1000

type SeedOutage = {
  // Also the seed's key: an outage with this note is seeded once
  note: string
  areaNames: string[]
  hoursAgo: number
  // Hours after confirming
  technician?: { email: string; assignedAfter: number }
  startedAfter?: number
  restoredAfter?: number
  cause?: OutageCause
  // Reports made just before confirming and linked; active outages also link the pending ones
  reports?: { email: string; description?: string }[]
}

/*
Restored outages over the past month, for the analytics: every cause, both seeded zones, and
restoration times from under an hour to most of a day
*/
const HISTORY: SeedOutage[] = [
  {
    note: "Transformer overloaded in the heat, replaced overnight",
    areaNames: ["Mirpur 11, Block B"],
    hoursAgo: 26 * 24,
    technician: { email: "technician02@example.com", assignedAfter: 0.5 },
    startedAfter: 1.5,
    restoredAfter: 14,
    cause: "TRANSFORMER_FAULT",
  },
  {
    note: "Cable cut by a drainage dig, spliced",
    areaNames: ["Pallabi, Section 6", "Pallabi, Section 7"],
    hoursAgo: 21 * 24,
    technician: { email: "technician03@example.com", assignedAfter: 0.75 },
    startedAfter: 1.25,
    restoredAfter: 7,
    cause: "CABLE_DAMAGE",
  },
  {
    note: "Storm damage to an overhead line, made safe and repaired",
    areaNames: ["Mirpur 10, Block A", "Mirpur 10, Block C"],
    hoursAgo: 17 * 24,
    technician: { email: "technician01@example.com", assignedAfter: 0.5 },
    startedAfter: 1,
    restoredAfter: 4.5,
    cause: "EMERGENCY_MAINTENANCE",
  },
  {
    note: "Breaker tripped during a voltage dip",
    areaNames: ["Mirpur 12, Block D"],
    hoursAgo: 12 * 24,
    technician: { email: "technician02@example.com", assignedAfter: 0.25 },
    restoredAfter: 0.5,
    cause: "TEMPORARY_TRIP",
  },
  {
    note: "Bird strike on a pole-mounted switch",
    areaNames: ["Pallabi, Section 7"],
    hoursAgo: 8 * 24,
    technician: { email: "technician03@example.com", assignedAfter: 0.5 },
    startedAfter: 1,
    restoredAfter: 2.5,
    cause: "OTHER",
  },
  {
    note: "Joint failure on the Road 32 cable, rejointed",
    areaNames: ["Dhanmondi Road 32"],
    hoursAgo: 24 * 24,
    technician: { email: "technician04@example.com", assignedAfter: 1 },
    startedAfter: 2,
    restoredAfter: 9,
    cause: "CABLE_DAMAGE",
  },
  {
    note: "Distribution transformer burned out, replaced",
    areaNames: ["Jigatola", "Hazaribagh"],
    hoursAgo: 15 * 24,
    technician: { email: "technician05@example.com", assignedAfter: 0.75 },
    startedAfter: 1.5,
    restoredAfter: 18,
    cause: "TRANSFORMER_FAULT",
  },
  {
    note: "Breaker tripped and was reset",
    areaNames: ["Dhanmondi Road 27"],
    hoursAgo: 6 * 24,
    technician: { email: "technician04@example.com", assignedAfter: 0.25 },
    restoredAfter: 0.75,
    cause: "TEMPORARY_TRIP",
  },
]

/*
One outage per status. Technician 01 has an outage in progress and two restored (one a temporary
trip that cleared before work started); Technician 02 has an assigned one. Dhanmondi's confirmed
outage links Customer 04's pending report and waits for a technician. Mirpur 10, Block C and
Pallabi, Section 6 stay free, so their pending reports can be confirmed
*/
const OUTAGES: SeedOutage[] = [
  {
    note: "Fault near Road 27, crews are on the way",
    areaNames: ["Dhanmondi Road 27", "Dhanmondi Road 32"],
    hoursAgo: 4,
  },
  {
    note: "Feeder breaker tripped, a technician is on the way",
    areaNames: ["Pallabi, Section 7"],
    hoursAgo: 1,
    technician: { email: "technician02@example.com", assignedAfter: 0.25 },
  },
  {
    note: "Underground cable damaged by roadwork, repairs underway",
    areaNames: ["Mirpur 11, Block B", "Mirpur 12, Block D"],
    hoursAgo: 3,
    technician: { email: "technician01@example.com", assignedAfter: 0.5 },
    startedAfter: 1,
    cause: "CABLE_DAMAGE",
  },
  {
    note: "Transformer failure, replaced and power restored",
    areaNames: ["Mirpur 10, Block C"],
    hoursAgo: 48,
    technician: { email: "technician01@example.com", assignedAfter: 0.5 },
    startedAfter: 1,
    restoredAfter: 5,
    cause: "TRANSFORMER_FAULT",
    reports: [
      { email: "customer01@example.com", description: "Loud bang from the transformer, then dark" },
      { email: "customer02@example.com" },
    ],
  },
  {
    note: "Breaker tripped and reset itself",
    areaNames: ["Mirpur 10, Block A"],
    hoursAgo: 120,
    technician: { email: "technician01@example.com", assignedAfter: 0.25 },
    restoredAfter: 0.75,
    cause: "TEMPORARY_TRIP",
    reports: [{ email: "customer07@example.com", description: "Power flickered and went off" }],
  },
]

const hoursAfter = (date: Date, hours: number) => new Date(date.getTime() + hours * HOUR_MS)

const seedOutage = async (seed: SeedOutage) => {
  const areas = await prisma.area.findMany({
    where: { name: { in: seed.areaNames }, deletedAt: null },
    select: { id: true, feeder: { select: { zoneId: true } } },
  })
  const zoneId = areas[0]?.feeder.zoneId

  if (!zoneId || areas.length !== seed.areaNames.length) return false

  const manager = await prisma.employee.findFirst({
    where: { role: "ZONE_MANAGER", zoneId, endedAt: null },
    select: { userId: true },
  })
  const technician =
    seed.technician &&
    (await prisma.employee.findFirst({
      where: { role: "TECHNICIAN", zoneId, endedAt: null, user: { email: seed.technician.email } },
      select: { id: true },
    }))

  if (!manager || (seed.technician && !technician)) return false

  const areaIds = areas.map((area) => area.id)
  const confirmedAt = new Date(Date.now() - seed.hoursAgo * HOUR_MS)
  const assignedAt = seed.technician && hoursAfter(confirmedAt, seed.technician.assignedAfter)
  const startedAt =
    seed.startedAfter === undefined ? null : hoursAfter(confirmedAt, seed.startedAfter)
  const restoredAt =
    seed.restoredAfter === undefined ? null : hoursAfter(confirmedAt, seed.restoredAfter)
  const status = restoredAt
    ? "RESTORED"
    : startedAt
      ? "IN_PROGRESS"
      : technician
        ? "ASSIGNED"
        : "CONFIRMED"
  const updatedAt = restoredAt ?? startedAt ?? assignedAt ?? confirmedAt

  const customers = await prisma.customer.findMany({
    where: { user: { email: { in: (seed.reports ?? []).map((report) => report.email) } } },
    select: { id: true, areaId: true, user: { select: { email: true } } },
  })
  const customerByEmail = new Map(customers.map((customer) => [customer.user.email, customer]))

  await prisma.$transaction(async (tx) => {
    const outage = await tx.outage.create({
      data: {
        zoneId,
        status,
        cause: seed.cause ?? null,
        note: seed.note,
        confirmedById: manager.userId,
        technicianId: technician ? technician.id : null,
        confirmedAt,
        assignedAt: assignedAt ?? null,
        startedAt,
        restoredAt,
        updatedAt,
        areas: { createMany: { data: areaIds.map((areaId) => ({ areaId })) } },
      },
      select: { id: true },
    })

    const reportedAt = hoursAfter(confirmedAt, -0.5)

    await tx.outageReport.createMany({
      data: (seed.reports ?? []).flatMap(({ email, description }) => {
        const customer = customerByEmail.get(email)

        return customer
          ? [
              {
                customerId: customer.id,
                areaId: customer.areaId,
                description: description ?? null,
                status: "LINKED" as const,
                outageId: outage.id,
                createdAt: reportedAt,
                updatedAt: confirmedAt,
              },
            ]
          : []
      }),
    })

    if (status !== "RESTORED") {
      await tx.outageReport.updateMany({
        where: { areaId: { in: areaIds }, status: "PENDING" },
        data: { status: "LINKED", outageId: outage.id, updatedAt: confirmedAt },
      })
    }
  })

  return true
}

// Safe to run again: an outage whose note is already there is skipped
export const seedOutages = async () => {
  const existing = await prisma.outage.findMany({ select: { note: true } })
  const seeded = new Set(existing.map((outage) => outage.note))
  let count = 0

  for (const seed of [...HISTORY, ...OUTAGES]) {
    if (!seeded.has(seed.note) && (await seedOutage(seed))) {
      count++
    }
  }

  logCount(count, "outage", "outages", "seeded")
}
