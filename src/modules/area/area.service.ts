import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
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

const getAllAreas = async (query: AreaListQuery) => {
  const { page, limit, search, zoneId, feederId } = query

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

const createArea = ({ feederId, name }: CreateAreaPayload) =>
  prisma.$transaction(async (tx) => {
    // Holds the feeder until the area is saved, so the feeder can't be deleted meanwhile
    if (!(await lockLiveRow(tx, "feeders", feederId, "SHARE"))) {
      throw new AppError(httpStatus.NOT_FOUND, "Feeder not found", [
        { path: "feederId", message: "Feeder not found" },
      ])
    }

    await assertNameFree(tx, feederId, name)

    return tx.area.create({ data: { feederId, name }, select: areaSelect })
  })

const updateArea = async (id: string, { name }: UpdateAreaPayload) => {
  const area = await prisma.area.findFirst({
    where: { id, deletedAt: null },
    select: { feederId: true },
  })

  if (!area) {
    throw areaNotFound()
  }

  await assertNameFree(prisma, area.feederId, name, id)

  return prisma.area.update({
    where: { id, deletedAt: null },
    data: { name },
    select: areaSelect,
  })
}

const deleteArea = (adminId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    if (!(await lockLiveRow(tx, "areas", id, "UPDATE"))) {
      throw areaNotFound()
    }

    const customers = await tx.customer.count({ where: { areaId: id } })

    if (customers > 0) {
      throw new AppError(httpStatus.CONFLICT, "Customers are still registered in this area")
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

export const areaService = { getAllAreas, createArea, updateArea, deleteArea }
