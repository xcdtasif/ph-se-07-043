import httpStatus from "http-status"

import { writeAuditLog } from "../../lib/audit.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { CreateZonePayload, UpdateZonePayload } from "./zone.schema.js"

const zoneSelect = { id: true, name: true, code: true } as const

const zoneNotFound = () => new AppError(httpStatus.NOT_FOUND, "Zone not found")

// The partial unique index still guards a race; this gives the usual case a clear message
const assertCodeFree = async (code: string, exceptId?: string) => {
  const zone = await prisma.zone.findFirst({
    where: { code, deletedAt: null, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  })

  if (zone) {
    throw new AppError(httpStatus.CONFLICT, "This zone code is already in use", [
      { path: "code", message: "Already in use" },
    ])
  }
}

const getAllZones = () =>
  prisma.zone.findMany({
    where: { deletedAt: null },
    select: zoneSelect,
    orderBy: { name: "asc" },
  })

const createZone = async (payload: CreateZonePayload) => {
  await assertCodeFree(payload.code)

  return prisma.zone.create({ data: payload, select: zoneSelect })
}

const updateZone = async (id: string, { name, code }: UpdateZonePayload) => {
  const zone = await prisma.zone.findFirst({ where: { id, deletedAt: null }, select: { id: true } })

  if (!zone) {
    throw zoneNotFound()
  }

  if (code) {
    await assertCodeFree(code, id)
  }

  return prisma.zone.update({
    where: { id, deletedAt: null },
    data: { ...(name && { name }), ...(code && { code }) },
    select: zoneSelect,
  })
}

const deleteZone = (adminId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    if (!(await lockLiveRow(tx, "zones", id, "UPDATE"))) {
      throw zoneNotFound()
    }

    const feeders = await tx.feeder.count({ where: { zoneId: id, deletedAt: null } })

    if (feeders > 0) {
      throw new AppError(httpStatus.CONFLICT, "Delete this zone's feeders first")
    }

    const employees = await tx.employee.count({ where: { zoneId: id, endedAt: null } })

    if (employees > 0) {
      throw new AppError(httpStatus.CONFLICT, "End this zone's employments first")
    }

    const zone = await tx.zone.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { ...zoneSelect, deletedAt: true },
    })

    await writeAuditLog(tx, {
      actorId: adminId,
      action: "ZONE_DELETED",
      entityType: "ZONE",
      entityId: id,
      before: { name: zone.name, code: zone.code, deletedAt: null },
      after: { deletedAt: zone.deletedAt?.toISOString() ?? null },
    })
  })

export const zoneService = { getAllZones, createZone, updateZone, deleteZone }
