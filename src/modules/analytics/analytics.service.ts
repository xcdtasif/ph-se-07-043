import httpStatus from "http-status"

import { Prisma } from "../../generated/prisma/client.js"
import { OutageCause, OutageReportStatus, OutageStatus } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { dhakaDayRange } from "../../utils/dhaka-time.js"
import { managedZoneId } from "../../utils/managed-zone.js"
import type { AuthUser } from "../auth/auth.user.js"
import type { OutageAnalyticsQuery } from "./analytics.schema.js"

const TOP_AREAS = 10

/*
Raw SQL below does the time math Prisma can't aggregate. Timestamps are stored as UTC without a
zone, so "now" is taken in UTC too, and a Dhaka day is the UTC time plus 6 hours (no DST)
*/
const NOW = Prisma.sql`(now() AT TIME ZONE 'UTC')`

// Every key of an enum, counted, so a chart gets a zero instead of a missing bar
const countBy = <K extends string>(
  keys: readonly K[],
  rows: { key: K | null; count: number }[],
): Record<K, number> => {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>

  for (const { key, count } of rows) {
    if (key !== null) {
      counts[key] = count
    }
  }

  return counts
}

// The zone to report on: a Zone Manager's own, or the admin's pick (null for the whole company)
const resolveZone = async (user: AuthUser, zoneId: string | undefined) => {
  if (user.employee?.role !== "ADMIN") {
    const ownZoneId = managedZoneId(user)

    if (zoneId && zoneId !== ownZoneId) {
      throw new AppError(httpStatus.FORBIDDEN, "You can only see your own zone's analytics")
    }

    zoneId = ownZoneId
  }

  if (!zoneId) {
    return null
  }

  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, deletedAt: null },
    select: { id: true, name: true, code: true },
  })

  if (!zone) {
    throw new AppError(httpStatus.NOT_FOUND, "Zone not found")
  }

  return zone
}

/*
Outages confirmed within the range: counts by status and cause, how long assigning and restoring
took, outages per Dhaka day, the areas that were off longest (an active outage counts until now),
and the range's reports by status. Company-wide, also each zone's numbers
*/
const getOutageAnalytics = async (user: AuthUser, query: OutageAnalyticsQuery) => {
  const zone = await resolveZone(user, query.zoneId)
  const { from, to } = query
  const start = dhakaDayRange(from).start
  const end = dhakaDayRange(to).end

  const where: Prisma.OutageWhereInput = {
    confirmedAt: { gte: start, lt: end },
    ...(zone && { zoneId: zone.id }),
  }
  const inRange = Prisma.sql`o.confirmed_at >= ${start} AND o.confirmed_at < ${end}`
  const inZone = zone ? Prisma.sql`AND o.zone_id = ${zone.id}` : Prisma.empty

  const [byStatus, byCause, reports, [durations], daily, topAreas, byZone] = await Promise.all([
    prisma.outage.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.outage.groupBy({
      by: ["cause"],
      where: { ...where, status: "RESTORED" },
      _count: { _all: true },
    }),
    prisma.outageReport.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: start, lt: end },
        ...(zone && { area: { feeder: { zoneId: zone.id } } }),
      },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ avgAssignMinutes: number | null; avgRestorationMinutes: number | null }[]>`
      SELECT
        round(avg(extract(epoch FROM o.assigned_at - o.confirmed_at) / 60))::int AS "avgAssignMinutes",
        round(avg(extract(epoch FROM o.restored_at - o.confirmed_at) / 60))::int AS "avgRestorationMinutes"
      FROM outages o
      WHERE ${inRange} ${inZone}
    `,
    prisma.$queryRaw<{ date: string; outages: number }[]>`
      SELECT to_char(d, 'YYYY-MM-DD') AS date, count(o.id)::int AS outages
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d
      LEFT JOIN outages o
        ON (o.confirmed_at + interval '6 hours')::date = d::date ${inZone}
      GROUP BY d
      ORDER BY d
    `,
    prisma.$queryRaw<
      {
        id: string
        name: string
        feederCode: string
        zoneCode: string
        outages: number
        minutesOff: number
      }[]
    >`
      SELECT a.id, a.name, f.code AS "feederCode", z.code AS "zoneCode",
        count(*)::int AS outages,
        round(sum(extract(epoch FROM coalesce(o.restored_at, ${NOW}) - o.confirmed_at) / 60))::int
          AS "minutesOff"
      FROM outages o
      JOIN outage_areas oa ON oa.outage_id = o.id
      JOIN areas a ON a.id = oa.area_id
      JOIN feeders f ON f.id = a.feeder_id
      JOIN zones z ON z.id = f.zone_id
      WHERE ${inRange} ${inZone}
      GROUP BY a.id, a.name, f.code, z.code
      ORDER BY "minutesOff" DESC, a.name
      LIMIT ${TOP_AREAS}
    `,
    zone
      ? null
      : prisma.$queryRaw<
          {
            id: string
            name: string
            code: string
            outages: number
            active: number
            avgRestorationMinutes: number | null
          }[]
        >`
          SELECT z.id, z.name, z.code,
            count(o.id)::int AS outages,
            count(o.id) FILTER (WHERE o.status <> 'RESTORED')::int AS active,
            round(avg(extract(epoch FROM o.restored_at - o.confirmed_at) / 60))::int
              AS "avgRestorationMinutes"
          FROM zones z
          LEFT JOIN outages o ON o.zone_id = z.id AND ${inRange}
          WHERE z.deleted_at IS NULL
          GROUP BY z.id, z.name, z.code
          ORDER BY z.name
        `,
  ])

  const statusCounts = countBy(
    Object.values(OutageStatus),
    byStatus.map((row) => ({ key: row.status, count: row._count._all })),
  )
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0)

  return {
    zone,
    from,
    to,
    outages: {
      total,
      active: total - statusCounts.RESTORED,
      restored: statusCounts.RESTORED,
      avgAssignMinutes: durations?.avgAssignMinutes ?? null,
      avgRestorationMinutes: durations?.avgRestorationMinutes ?? null,
    },
    byStatus: statusCounts,
    byCause: countBy(
      Object.values(OutageCause),
      byCause.map((row) => ({ key: row.cause, count: row._count._all })),
    ),
    reports: countBy(
      Object.values(OutageReportStatus),
      reports.map((row) => ({ key: row.status, count: row._count._all })),
    ),
    daily,
    topAreas,
    byZone,
  }
}

export const analyticsService = { getOutageAnalytics }
