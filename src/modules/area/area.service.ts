import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { bumpCache, cached } from "../../lib/cache.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { AreaListQuery, CreateAreaPayload, UpdateAreaPayload } from "./area.schema.js"

// The feeder and zone come along, so a picker can show "Mirpur 10, Block C · MIR-F01 · Mirpur"
const areaSelect = {
  id: true,
  name: true,
  feeder: {
    select: {
      id: true,
      name: true,
      code: true,
      zone: { select: { id: true, name: true, code: true } },
    },
  },
} as const

const areaNotFound = () => new AppError(httpStatus.NOT_FOUND, "Area not found")

/*
Ignores case, so "jigatola" can't sit next to "Jigatola". The partial unique index still guards
a race on the exact name
*/
const assertNameFree = async (
  tx: Prisma.TransactionClient,
  feederId: string,
  name: string,
  exceptId?: string,
) => {
  const area = await tx.area.findFirst({
    where: {
      feederId,
      name: { equals: name, mode: "insensitive" },
      deletedAt: null,
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  })

  if (area) {
    throw new AppError(httpStatus.CONFLICT, "This feeder already has an area with this name", [
      { path: "name", message: "Already in use" },
    ])
  }
}

const findAreas = async ({ page, limit, search, zoneId, feederId }: AreaListQuery) => {
  // Deleting a feeder or zone needs its children deleted first, so live areas have live parents
  const where: Prisma.AreaWhereInput = {
    deletedAt: null,
    ...(feederId && { feederId }),
    ...(zoneId && { feeder: { zoneId } }),
    ...(search && { name: { contains: search, mode: "insensitive" } }),
  }

  const [areas, total] = await Promise.all([
    prisma.area.findMany({
      where,
      select: areaSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.area.count({ where }),
  ])

  return { areas, meta: { page, limit, total } }
}

// The validated query has a fixed key order, so equal queries give equal keys
const getAllAreas = (query: AreaListQuery) =>
  cached("grid", `areas:${JSON.stringify(query)}`, () => findAreas(query))

const createArea = async ({ feederId, name }: CreateAreaPayload) => {
  const area = await prisma.$transaction(async (tx) => {
    // Holds the feeder until the area is saved, so the feeder can't be deleted meanwhile
    if (!(await lockLiveRow(tx, "feeders", feederId, "SHARE"))) {
      throw new AppError(httpStatus.NOT_FOUND, "Feeder not found", [
        { path: "feederId", message: "Feeder not found" },
      ])
    }

    await assertNameFree(tx, feederId, name)

    return tx.area.create({ data: { feederId, name }, select: areaSelect })
  })
  await bumpCache("grid")

  return area
}

const updateArea = async (id: string, { name }: UpdateAreaPayload) => {
  const area = await prisma.area.findFirst({
    where: { id, deletedAt: null },
    select: { feederId: true },
  })

  if (!area) {
    throw areaNotFound()
  }

  await assertNameFree(prisma, area.feederId, name, id)

  const updated = await prisma.area.update({
    where: { id, deletedAt: null },
    data: { name },
    select: areaSelect,
  })
  // Outages show area names; slots don't
  await bumpCache("grid", "outages")

  return updated
}

const deleteArea = async (adminId: string, id: string) => {
  await prisma.$transaction(async (tx) => {
    if (!(await lockLiveRow(tx, "areas", id, "UPDATE"))) {
      throw areaNotFound()
    }

    const customers = await tx.customer.count({ where: { areaId: id } })

    if (customers > 0) {
      throw new AppError(httpStatus.CONFLICT, "Customers are still registered in this area")
    }

    // Confirming an outage locks its areas FOR UPDATE too, so this can't miss one being confirmed
    const activeOutage = await tx.outageArea.findFirst({
      where: { areaId: id, outage: { status: { not: "RESTORED" } } },
      select: { outageId: true },
    })

    if (activeOutage) {
      throw new AppError(httpStatus.CONFLICT, "This area has an active outage")
    }

    const area = await tx.area.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { name: true, feederId: true, deletedAt: true },
    })

    await writeAuditLog(tx, {
      actorId: adminId,
      action: "AREA_DELETED",
      entityType: "AREA",
      entityId: id,
      before: { name: area.name, feederId: area.feederId, deletedAt: null },
      after: { deletedAt: area.deletedAt?.toISOString() ?? null },
    })
  })
  await bumpCache("grid", "schedules", "outages")
}

export const areaService = { getAllAreas, createArea, updateArea, deleteArea }
