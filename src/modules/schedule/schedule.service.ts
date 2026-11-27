import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { bumpCache, cached } from "../../lib/cache.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { dhakaDayRange } from "../../utils/dhaka-time.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { AuthUser } from "../auth/auth.user.js"
import { slotWindowIssues } from "./schedule.rules.js"
import type {
  ConfirmDayPayload,
  CreateSlotPayload,
  ScheduleQuery,
  UpdateSlotPayload,
} from "./schedule.schema.js"

const slotSelect = {
  id: true,
  feederId: true,
  startsAt: true,
  endsAt: true,
  status: true,
} as const

// authorize("ZONE_MANAGER") runs first, and a Zone Manager always has a zone
const managedZoneId = (user: AuthUser) => {
  const zoneId = user.employee?.zoneId

  if (!zoneId) {
    throw new AppError(httpStatus.FORBIDDEN, "You don't have permission to do this")
  }

  return zoneId
}

/*
Locks the feeder FOR UPDATE, so slot changes on one feeder take turns: two can't both pass the
overlap check. It also holds off the feeder's deletion until the change is saved
*/
const lockFeederInZone = async (tx: Prisma.TransactionClient, feederId: string, zoneId: string) => {
  if (!(await lockLiveRow(tx, "feeders", feederId, "UPDATE"))) {
    throw new AppError(httpStatus.NOT_FOUND, "Feeder not found", [
      { path: "feederId", message: "Feeder not found" },
    ])
  }

  const feeder = await tx.feeder.findUniqueOrThrow({
    where: { id: feederId },
    select: { zoneId: true },
  })

  if (feeder.zoneId !== zoneId) {
    throw new AppError(httpStatus.FORBIDDEN, "This feeder isn't in your zone")
  }
}

// Slots that only touch (one ends as the next starts) don't overlap
const assertNoOverlap = async (
  tx: Prisma.TransactionClient,
  feederId: string,
  startsAt: Date,
  endsAt: Date,
  exceptId?: string,
) => {
  const clash = await tx.loadSheddingSlot.findFirst({
    where: {
      feederId,
      status: { not: "CANCELLED" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { startsAt: true, endsAt: true },
  })

  if (clash) {
    throw new AppError(httpStatus.CONFLICT, "This slot overlaps another slot on the feeder", [
      {
        path: "startsAt",
        message: `Overlaps the slot from ${clash.startsAt.toISOString()} to ${clash.endsAt.toISOString()}`,
      },
    ])
  }
}

// The slot, if it's in the Zone Manager's zone
const findOwnSlot = async (tx: Prisma.TransactionClient, id: string, zoneId: string) => {
  const slot = await tx.loadSheddingSlot.findUnique({
    where: { id },
    select: { ...slotSelect, feeder: { select: { zoneId: true } } },
  })

  if (!slot) {
    throw new AppError(httpStatus.NOT_FOUND, "Slot not found")
  }

  if (slot.feeder.zoneId !== zoneId) {
    throw new AppError(httpStatus.FORBIDDEN, "This slot isn't in your zone")
  }

  return slot
}

const createSlot = async (user: AuthUser, { feederId, startsAt, endsAt }: CreateSlotPayload) => {
  const zoneId = managedZoneId(user)

  const slot = await prisma.$transaction(async (tx) => {
    await lockFeederInZone(tx, feederId, zoneId)
    await assertNoOverlap(tx, feederId, startsAt, endsAt)

    return tx.loadSheddingSlot.create({
      data: { feederId, startsAt, endsAt, createdById: user.id },
      select: slotSelect,
    })
  })
  await bumpCache("schedules")

  return slot
}

const updateSlot = async (user: AuthUser, id: string, payload: UpdateSlotPayload) => {
  const zoneId = managedZoneId(user)

  const updated = await prisma.$transaction(async (tx) => {
    const { feederId } = await findOwnSlot(tx, id, zoneId)

    await lockFeederInZone(tx, feederId, zoneId)

    // Read again under the lock: the slot may have changed while we waited
    const slot = await findOwnSlot(tx, id, zoneId)

    if (slot.status !== "TENTATIVE") {
      throw new AppError(
        httpStatus.CONFLICT,
        slot.status === "CONFIRMED"
          ? "A confirmed slot can't be changed; cancel it and add a new one"
          : "A cancelled slot can't be changed",
      )
    }

    if (slot.startsAt <= new Date()) {
      throw new AppError(httpStatus.CONFLICT, "This slot has already started")
    }

    const startsAt = payload.startsAt ?? slot.startsAt
    const endsAt = payload.endsAt ?? slot.endsAt
    const issues = slotWindowIssues(startsAt, endsAt)

    if (issues.length > 0) {
      throw new AppError(httpStatus.BAD_REQUEST, "Validation of body failed", issues)
    }

    await assertNoOverlap(tx, feederId, startsAt, endsAt, id)

    return tx.loadSheddingSlot.update({
      where: { id },
      data: { startsAt, endsAt },
      select: slotSelect,
    })
  })
  await bumpCache("schedules")

  return updated
}

const cancelSlot = async (user: AuthUser, id: string) => {
  const zoneId = managedZoneId(user)

  const cancelled = await prisma.$transaction(async (tx) => {
    const slot = await findOwnSlot(tx, id, zoneId)

    // Conditional, so a slot that started or was cancelled meanwhile isn't cancelled again
    const { count } = await tx.loadSheddingSlot.updateMany({
      where: { id, status: { not: "CANCELLED" }, startsAt: { gt: new Date() } },
      data: { status: "CANCELLED" },
    })

    if (count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        slot.status === "CANCELLED" ? "Slot is already cancelled" : "This slot has already started",
      )
    }

    await writeAuditLog(tx, {
      actorId: user.id,
      action: "SLOT_CANCELLED",
      entityType: "SLOT",
      entityId: id,
      before: { status: slot.status },
      after: { status: "CANCELLED" },
    })

    return tx.loadSheddingSlot.findUniqueOrThrow({ where: { id }, select: slotSelect })
  })
  await bumpCache("schedules")

  return cancelled
}

// Confirms every tentative slot in the zone that starts on this Dhaka day
const confirmDay = async (user: AuthUser, { date }: ConfirmDayPayload) => {
  const zoneId = managedZoneId(user)
  const { start, end } = dhakaDayRange(date)
  const where = {
    feeder: { zoneId },
    status: "TENTATIVE",
    startsAt: { gte: start, lt: end },
  } satisfies Prisma.LoadSheddingSlotWhereInput

  const result = await prisma.$transaction(async (tx) => {
    const pending = await tx.loadSheddingSlot.findMany({ where, select: { id: true } })

    if (pending.length === 0) {
      throw new AppError(httpStatus.CONFLICT, "No tentative slots to confirm on this day")
    }

    const ids = pending.map((slot) => slot.id)

    // The same conditions again, so a slot edited or cancelled meanwhile is left alone
    await tx.loadSheddingSlot.updateMany({
      where: { ...where, id: { in: ids } },
      data: { status: "CONFIRMED" },
    })

    // Rows this transaction updated stay locked until it ends, so this reads exactly those
    const slots = await tx.loadSheddingSlot.findMany({
      where: { id: { in: ids }, status: "CONFIRMED" },
      select: slotSelect,
      orderBy: [{ startsAt: "asc" }, { feederId: "asc" }],
    })

    await writeAuditLog(tx, {
      actorId: user.id,
      action: "SCHEDULE_DAY_CONFIRMED",
      entityType: "ZONE",
      entityId: zoneId,
      after: { date, slotIds: slots.map((slot) => slot.id) },
    })

    return { date, slots }
  })
  await bumpCache("schedules")

  return result
}

// Which feeders a public read covers; a deleted or unknown area, feeder or zone is a 404
const feederFilter = async ({
  areaId,
  feederId,
  zoneId,
}: ScheduleQuery): Promise<Prisma.LoadSheddingSlotWhereInput> => {
  if (areaId) {
    const area = await prisma.area.findFirst({
      where: { id: areaId, deletedAt: null },
      select: { feederId: true },
    })

    if (!area) {
      throw new AppError(httpStatus.NOT_FOUND, "Area not found")
    }

    return { feederId: area.feederId }
  }

  if (feederId) {
    const feeder = await prisma.feeder.findFirst({
      where: { id: feederId, deletedAt: null },
      select: { id: true },
    })

    if (!feeder) {
      throw new AppError(httpStatus.NOT_FOUND, "Feeder not found")
    }

    return { feederId }
  }

  // The schema lets exactly one filter through, so this is the zoneId
  const zone =
    zoneId &&
    (await prisma.zone.findFirst({ where: { id: zoneId, deletedAt: null }, select: { id: true } }))

  if (!zoneId || !zone) {
    throw new AppError(httpStatus.NOT_FOUND, "Zone not found")
  }

  return { feeder: { zoneId, deletedAt: null } }
}

/*
Slots starting on the Dhaka days from `from` to `to`, cancelled ones included so a customer
who saw the forecast learns the power stays on
*/
const findSchedule = async (query: ScheduleQuery) => {
  const { from, to } = query

  const slots = await prisma.loadSheddingSlot.findMany({
    where: {
      ...(await feederFilter(query)),
      startsAt: { gte: dhakaDayRange(from).start, lt: dhakaDayRange(to).end },
    },
    select: { ...slotSelect, feeder: { select: { name: true, code: true } } },
    orderBy: [{ startsAt: "asc" }, { feederId: "asc" }],
  })

  return { from, to, slots }
}

// The validated query has a fixed key order and resolved dates, so equal reads share a key
const getSchedule = (query: ScheduleQuery) =>
  cached("schedules", JSON.stringify(query), () => findSchedule(query))

export const scheduleService = { createSlot, updateSlot, cancelSlot, confirmDay, getSchedule }
