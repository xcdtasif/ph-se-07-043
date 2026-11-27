import httpStatus from "http-status"

import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { customerSelect } from "../auth/auth.user.js"
import type { CreateCustomerPayload, UpdateCustomerPayload } from "./customer.schema.js"

const assertAreaExists = async (areaId: string) => {
  const area = await prisma.area.findFirst({
    where: { id: areaId, deletedAt: null },
    select: { id: true },
  })

  if (!area) {
    throw new AppError(httpStatus.NOT_FOUND, "Area not found", [
      { path: "areaId", message: "Area not found" },
    ])
  }
}

// The unique index still guards a race; this gives the usual case a clear message
const assertMeterFree = async (meterNumber: string, userId: string) => {
  const owner = await prisma.customer.findUnique({
    where: { meterNumber },
    select: { userId: true },
  })

  if (owner && owner.userId !== userId) {
    throw new AppError(httpStatus.CONFLICT, "This meter number is already registered", [
      { path: "meterNumber", message: "Already registered" },
    ])
  }
}

const createMe = async (userId: string, { areaId, meterNumber }: CreateCustomerPayload) => {
  const existing = await prisma.customer.findUnique({ where: { userId }, select: { id: true } })

  if (existing) {
    throw new AppError(httpStatus.CONFLICT, "You already have a customer profile")
  }

  await assertAreaExists(areaId)
  if (meterNumber) {
    await assertMeterFree(meterNumber, userId)
  }

  return prisma.customer.create({
    data: { userId, areaId, meterNumber: meterNumber ?? null },
    select: customerSelect,
  })
}

const updateMe = async (userId: string, { areaId, meterNumber }: UpdateCustomerPayload) => {
  const existing = await prisma.customer.findUnique({ where: { userId }, select: { id: true } })

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Create your customer profile first")
  }

  if (areaId) {
    await assertAreaExists(areaId)
  }
  if (meterNumber) {
    await assertMeterFree(meterNumber, userId)
  }

  return prisma.customer.update({
    where: { userId },
    data: { ...(areaId && { areaId }), ...(meterNumber !== undefined && { meterNumber }) },
    select: customerSelect,
  })
}

export const customerService = { createMe, updateMe }
