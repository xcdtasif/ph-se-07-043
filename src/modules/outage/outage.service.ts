import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { bumpCache, cached } from "../../lib/cache.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockEmployee } from "../../utils/lock-employee.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import { managedZoneId } from "../../utils/managed-zone.js"
import type { AuthUser } from "../auth/auth.user.js"
import type {
  AssignedOutagesQuery,
  AssignOutagePayload,
  ConfirmOutagePayload,
  OutagesQuery,
  UpdateOutageStatusPayload,
} from "./outage.schema.js"

// What the public status page shows: no staff or customer details
const outageSelect = {
  id: true,
  status: true,
  cause: true,
  note: true,
  confirmedAt: true,
  assignedAt: true,
  startedAt: true,
  restoredAt: true,
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

// A technician's job is active while assigned or in progress; they have at most one
export const activeJob = {
  status: { in: ["ASSIGNED", "IN_PROGRESS"] },
} satisfies Prisma.OutageWhereInput

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

// The outage, if it's in the Zone Manager's zone
const findZoneOutage = async (id: string, zoneId: string) => {
  const outage = await prisma.outage.findUnique({
    where: { id },
    select: { zoneId: true, status: true, technicianId: true },
  })

  if (!outage) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage not found")
  }

  if (outage.zoneId !== zoneId) {
    throw new AppError(httpStatus.FORBIDDEN, "This outage isn't in your zone")
  }

  return outage
}

/*
Assigns a technician of the zone, or hands the outage to another one before work starts. The
technician's row is locked, so they can't be given two jobs at once or leave while being assigned
*/
const assignOutage = async (user: AuthUser, id: string, { technicianId }: AssignOutagePayload) => {
  const zoneId = managedZoneId(user)
  const outage = await findZoneOutage(id, zoneId)

  if (outage.status === "IN_PROGRESS" || outage.status === "RESTORED") {
    throw new AppError(
      httpStatus.CONFLICT,
      outage.status === "RESTORED"
        ? "This outage is already restored"
        : "Work has started on this outage; it can't be reassigned",
    )
  }

  await prisma.$transaction(async (tx) => {
    const technician = (await lockEmployee(tx, technicianId))
      ? await tx.employee.findUnique({
          where: { id: technicianId },
          select: { role: true, zoneId: true, endedAt: true },
        })
      : null

    if (!technician || technician.role !== "TECHNICIAN" || technician.endedAt) {
      throw new AppError(httpStatus.NOT_FOUND, "Technician not found", [
        { path: "technicianId", message: "No active technician with this id" },
      ])
    }

    if (technician.zoneId !== zoneId) {
      throw new AppError(httpStatus.FORBIDDEN, "This technician isn't in your zone")
    }

    const busy = await tx.outage.findFirst({
      where: { technicianId, ...activeJob },
      select: { id: true },
    })

    if (busy) {
      throw new AppError(
        httpStatus.CONFLICT,
        busy.id === id
          ? "This technician is already assigned to this outage"
          : "This technician already has an active job",
      )
    }

    // Conditional, so an outage the technician started meanwhile isn't taken from them
    const { count } = await tx.outage.updateMany({
      where: { id, status: { in: ["CONFIRMED", "ASSIGNED"] } },
      data: { status: "ASSIGNED", technicianId, assignedAt: new Date() },
    })

    if (count === 0) {
      throw new AppError(httpStatus.CONFLICT, "This outage changed meanwhile; reload it")
    }

    await writeAuditLog(tx, {
      actorId: user.id,
      action: "OUTAGE_ASSIGNED",
      entityType: "OUTAGE",
      entityId: id,
      before: { status: outage.status, technicianId: outage.technicianId },
      after: { status: "ASSIGNED", technicianId },
    })
  })
  await bumpCache("outages")

  return getOutage(id)
}

// The technician's own employee row; authorize("TECHNICIAN") runs first
const technicianId = (user: AuthUser) => {
  if (user.employee?.role !== "TECHNICIAN") {
    throw new AppError(httpStatus.FORBIDDEN, "You don't have permission to do this")
  }

  return user.employee.id
}

const getAssignedOutages = async (
  user: AuthUser,
  { page, limit, status }: AssignedOutagesQuery,
) => {
  const where: Prisma.OutageWhereInput = {
    technicianId: technicianId(user),
    ...(status && { status }),
  }

  const [outages, total] = await Promise.all([
    prisma.outage.findMany({
      where,
      select: outageSelect,
      orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.outage.count({ where }),
  ])

  return { outages: outages.map(toOutage), meta: { page, limit, total } }
}

/*
ASSIGNED → IN_PROGRESS → RESTORED. A temporary trip that cleared by itself can go from ASSIGNED
straight to RESTORED. Restoring needs the cause, sent now or earlier
*/
const updateOutageStatus = async (
  user: AuthUser,
  id: string,
  { status, cause }: UpdateOutageStatusPayload,
) => {
  const ownId = technicianId(user)

  const outage = await prisma.outage.findUnique({
    where: { id },
    select: { status: true, cause: true, technicianId: true },
  })

  if (!outage) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage not found")
  }

  if (outage.technicianId !== ownId) {
    throw new AppError(httpStatus.FORBIDDEN, "This outage isn't assigned to you")
  }

  if (outage.status === "RESTORED") {
    throw new AppError(httpStatus.CONFLICT, "This outage is already restored")
  }

  if (status === "IN_PROGRESS" && outage.status === "IN_PROGRESS") {
    throw new AppError(httpStatus.CONFLICT, "Work on this outage has already started")
  }

  const finalCause = cause ?? outage.cause

  if (status === "RESTORED" && !finalCause) {
    throw new AppError(httpStatus.BAD_REQUEST, "Validation of body failed", [
      { path: "cause", message: "Set the cause when restoring" },
    ])
  }

  if (status === "RESTORED" && outage.status === "ASSIGNED" && finalCause !== "TEMPORARY_TRIP") {
    throw new AppError(
      httpStatus.CONFLICT,
      "Start work first; only a temporary trip can be restored straight away",
    )
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // Conditional on what was checked, so a reassignment or another update meanwhile wins
    const { count } = await tx.outage.updateMany({
      where: { id, technicianId: ownId, status: outage.status },
      data: {
        status,
        ...(cause && { cause }),
        ...(status === "IN_PROGRESS" ? { startedAt: now } : { restoredAt: now }),
      },
    })

    if (count === 0) {
      throw new AppError(httpStatus.CONFLICT, "This outage changed meanwhile; reload it")
    }

    await writeAuditLog(tx, {
      actorId: user.id,
      action: "OUTAGE_STATUS_CHANGED",
      entityType: "OUTAGE",
      entityId: id,
      before: { status: outage.status, cause: outage.cause },
      after: { status, cause: finalCause },
    })
  })
  await bumpCache("outages")

  return getOutage(id)
}

export const outageService = {
  confirmOutage,
  getOutages,
  getOutage,
  assignOutage,
  getAssignedOutages,
  updateOutageStatus,
}
