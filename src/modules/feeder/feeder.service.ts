import httpStatus from "http-status"

import { writeAuditLog } from "../../lib/audit.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { CreateFeederPayload, FeederListQuery, UpdateFeederPayload } from "./feeder.schema.js"

const feederSelect = { id: true, zoneId: true, name: true, code: true } as const

const feederNotFound = () => new AppError(httpStatus.NOT_FOUND, "Feeder not found")

// The partial unique index still guards a race; this gives the usual case a clear message
const assertCodeFree = async (code: string, exceptId?: string) => {
  const feeder = await prisma.feeder.findFirst({
    where: { code, deletedAt: null, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  })

  if (feeder) {
    throw new AppError(httpStatus.CONFLICT, "This feeder code is already in use", [
      { path: "code", message: "Already in use" },
    ])
  }
}

const getAllFeeders = ({ zoneId }: FeederListQuery) =>
  prisma.feeder.findMany({
    where: { deletedAt: null, ...(zoneId && { zoneId }) },
    select: feederSelect,
    orderBy: { code: "asc" },
  })

const createFeeder = async (payload: CreateFeederPayload) => {
  await assertCodeFree(payload.code)

  return prisma.$transaction(async (tx) => {
    // Holds the zone until the feeder is saved, so the zone can't be deleted meanwhile
    if (!(await lockLiveRow(tx, "zones", payload.zoneId, "SHARE"))) {
      throw new AppError(httpStatus.NOT_FOUND, "Zone not found", [
        { path: "zoneId", message: "Zone not found" },
      ])
    }

    return tx.feeder.create({ data: payload, select: feederSelect })
  })
}

const updateFeeder = async (id: string, { name, code }: UpdateFeederPayload) => {
  const feeder = await prisma.feeder.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })

  if (!feeder) {
    throw feederNotFound()
  }

  if (code) {
    await assertCodeFree(code, id)
  }

  return prisma.feeder.update({
    where: { id, deletedAt: null },
    data: { ...(name && { name }), ...(code && { code }) },
    select: feederSelect,
  })
}

const deleteFeeder = (adminId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    if (!(await lockLiveRow(tx, "feeders", id, "UPDATE"))) {
      throw feederNotFound()
    }

    const areas = await tx.area.count({ where: { feederId: id, deletedAt: null } })

    if (areas > 0) {
      throw new AppError(httpStatus.CONFLICT, "Delete this feeder's areas first")
    }

    const upcomingSlots = await tx.loadSheddingSlot.count({
      where: { feederId: id, status: { not: "CANCELLED" }, endsAt: { gt: new Date() } },
    })

    if (upcomingSlots > 0) {
      throw new AppError(httpStatus.CONFLICT, "Cancel this feeder's upcoming slots first")
    }

    const feeder = await tx.feeder.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { ...feederSelect, deletedAt: true },
    })

    await writeAuditLog(tx, {
      actorId: adminId,
      action: "FEEDER_DELETED",
      entityType: "FEEDER",
      entityId: id,
      before: { name: feeder.name, code: feeder.code, deletedAt: null },
      after: { deletedAt: feeder.deletedAt?.toISOString() ?? null },
    })
  })

export const feederService = { getAllFeeders, createFeeder, updateFeeder, deleteFeeder }
