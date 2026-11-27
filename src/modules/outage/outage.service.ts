import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { bumpCache, cached } from "../../lib/cache.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import { managedZoneId } from "../../utils/managed-zone.js"
import type { AuthUser } from "../auth/auth.user.js"
import type { ConfirmOutagePayload, OutagesQuery } from "./outage.schema.js"

// What the public status page shows: no staff or customer details
const outageSelect = {
  id: true,
  status: true,
  note: true,
  confirmedAt: true,
  updatedAt: true,
  zone: { select: { id: true, name: true } },
  areas: {
    select: {
      area: {
        select: {
          id: true,
          name: true,
          feeder: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { area: { name: "asc" } },
  },
  _count: { select: { reports: true } },
} as const

type OutageRow = Prisma.OutageGetPayload<{ select: typeof outageSelect }>

const toOutage = ({ areas, _count, ...outage }: OutageRow) => ({
  ...outage,
  areas: areas.map(({ area }) => area),
  reportCount: _count.reports,
})

// Active means not restored yet; an area is in at most one active outage
export const activeOutage = { status: { not: "RESTORED" } } satisfies Prisma.OutageWhereInput

/*
Locks the areas FOR UPDATE in id order, so two confirms over the same areas take turns (and
can't deadlock), and a report made meanwhile waits to see the outage. Every area must be live and
in the zone, with no active outage
*/
const lockFreeAreas = async (tx: Prisma.TransactionClient, areaIds: string[], zoneId: string) => {
  for (const areaId of areaIds) {
    if (!(await lockLiveRow(tx, "areas", areaId, "UPDATE"))) {
      throw new AppError(httpStatus.NOT_FOUND, "Area not found", [
        { path: "areaIds", message: `Area ${areaId} not found` },
      ])
    }
  }

  const areas = await tx.area.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, name: true, feeder: { select: { zoneId: true } } },
  })
  const outside = areas.filter((area) => area.feeder.zoneId !== zoneId)

  if (outside.length > 0) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "These areas aren't in your zone",
      outside.map((area) => ({ path: "areaIds", message: `${area.name} isn't in your zone` })),
    )
  }

  const taken = await tx.outageArea.findMany({
    where: { areaId: { in: areaIds }, outage: activeOutage },
    select: { outageId: true, area: { select: { name: true } } },
  })

  if (taken.length > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Some areas already have an active outage",
      taken.map(({ outageId, area }) => ({
        path: "areaIds",
        message: `${area.name} is in outage ${outageId}`,
      })),
    )
  }
}

// The given reports' areas; a report must exist and be in the zone (its status is checked later)
const reportAreaIds = async (reportIds: string[], zoneId: string) => {
  if (reportIds.length === 0) return []

  const reports = await prisma.outageReport.findMany({
    where: { id: { in: reportIds } },
    select: { id: true, areaId: true, area: { select: { feeder: { select: { zoneId: true } } } } },
  })
  const found = new Set(reports.map((report) => report.id))
  const missing = reportIds.filter((id) => !found.has(id))

  if (missing.length > 0) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Report not found",
      missing.map((id) => ({ path: "reportIds", message: `Report ${id} not found` })),
    )
  }

  if (reports.some((report) => report.area.feeder.zoneId !== zoneId)) {
    throw new AppError(httpStatus.FORBIDDEN, "Some reports aren't in your zone")
  }

  return reports.map((report) => report.areaId)
}

const confirmOutage = async (
  user: AuthUser,
  { areaIds = [], reportIds = [], note }: ConfirmOutagePayload,
) => {
  const zoneId = managedZoneId(user)
  const givenReportIds = [...new Set(reportIds)]
  // A report's area never changes, so this can be read before the locks
  const allAreaIds = [
    ...new Set([...areaIds, ...(await reportAreaIds(givenReportIds, zoneId))]),
  ].sort()

  const outageId = await prisma.$transaction(async (tx) => {
    await lockFreeAreas(tx, allAreaIds, zoneId)

    const outage = await tx.outage.create({
      data: {
        zoneId,
        note: note ?? null,
        confirmedById: user.id,
        areas: { createMany: { data: allAreaIds.map((areaId) => ({ areaId })) } },
      },
      select: { id: true },
    })

    // Conditional, so a report dismissed meanwhile is left alone
    await tx.outageReport.updateMany({
      where: { areaId: { in: allAreaIds }, status: "PENDING" },
      data: { status: "LINKED", outageId: outage.id },
    })

    // Rows this transaction updated stay locked until it ends, so this reads exactly those
    const linked = await tx.outageReport.findMany({
      where: { outageId: outage.id },
      select: { id: true },
    })
    const linkedIds = new Set(linked.map((report) => report.id))
    const notPending = givenReportIds.filter((id) => !linkedIds.has(id))

    // The Zone Manager confirmed from these reports, so one that's no longer pending stops it
    if (notPending.length > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Some reports are no longer pending",
        notPending.map((id) => ({ path: "reportIds", message: `Report ${id} isn't pending` })),
      )
    }

    await writeAuditLog(tx, {
      actorId: user.id,
      action: "OUTAGE_CONFIRMED",
      entityType: "OUTAGE",
      entityId: outage.id,
      after: { zoneId, areaIds: allAreaIds, reportIds: [...linkedIds] },
    })

    return outage.id
  })
  await bumpCache("outages")

  return getOutage(outageId)
}

const findOutages = async ({ page, limit, status, zoneId, areaId }: OutagesQuery) => {
  const where: Prisma.OutageWhereInput = {
    ...(status && { status }),
    ...(zoneId && { zoneId }),
    ...(areaId && { areas: { some: { areaId } } }),
  }

  const [outages, total] = await Promise.all([
    prisma.outage.findMany({
      where,
      select: outageSelect,
      orderBy: [{ confirmedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.outage.count({ where }),
  ])

  return { outages: outages.map(toOutage), meta: { page, limit, total } }
}

// The validated query has a fixed key order, so equal reads share a key
const getOutages = (query: OutagesQuery) =>
  cached("outages", `list:${JSON.stringify(query)}`, () => findOutages(query))

const getOutage = (id: string) =>
  cached("outages", `one:${id}`, async () => {
    const outage = await prisma.outage.findUnique({ where: { id }, select: outageSelect })

    if (!outage) {
      throw new AppError(httpStatus.NOT_FOUND, "Outage not found")
    }

    return toOutage(outage)
  })

export const outageService = { confirmOutage, getOutages, getOutage }
