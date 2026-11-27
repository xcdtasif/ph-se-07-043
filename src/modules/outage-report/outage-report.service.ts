import httpStatus from "http-status"

import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { managedZoneId } from "../../utils/managed-zone.js"
import type { AuthUser } from "../auth/auth.user.js"
import type {
  CreateReportPayload,
  DismissReportPayload,
  MyReportsQuery,
  ZoneReportsQuery,
} from "./outage-report.schema.js"

const reportSelect = {
  id: true,
  status: true,
  description: true,
  dismissReason: true,
  createdAt: true,
  updatedAt: true,
  area: { select: { id: true, name: true } },
} as const

// What a Zone Manager sees: who reported, and the area's feeder for triage
const zoneReportSelect = {
  ...reportSelect,
  area: {
    select: { id: true, name: true, feeder: { select: { id: true, name: true, code: true } } },
  },
  customer: { select: { meterNumber: true, user: { select: { name: true } } } },
} as const

// authorize("CUSTOMER") runs first, so the profile is there
const customerProfile = (user: AuthUser) => {
  if (!user.customer) {
    throw new AppError(httpStatus.FORBIDDEN, "Create your customer profile first")
  }

  return user.customer
}

/*
The area is the customer's current one. One pending report per customer per area: the partial
unique index decides, so two reports sent at once can't both get in
*/
const createReport = async (user: AuthUser, { description }: CreateReportPayload) => {
  const { id: customerId, areaId } = customerProfile(user)

  try {
    return await prisma.outageReport.create({
      data: { customerId, areaId, description: description ?? null },
      select: reportSelect,
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(httpStatus.CONFLICT, "You already have a pending report for this area")
    }

    throw err
  }
}

const getMyReports = async (user: AuthUser, { page, limit, status }: MyReportsQuery) => {
  const where: Prisma.OutageReportWhereInput = {
    customerId: customerProfile(user).id,
    ...(status && { status }),
  }

  const [reports, total] = await Promise.all([
    prisma.outageReport.findMany({
      where,
      select: reportSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.outageReport.count({ where }),
  ])

  return { reports, meta: { page, limit, total } }
}

const getZoneReports = async (user: AuthUser, query: ZoneReportsQuery) => {
  const { page, limit, status, areaId, sortOrder } = query

  const where: Prisma.OutageReportWhereInput = {
    area: { feeder: { zoneId: managedZoneId(user) } },
    ...(status && { status }),
    ...(areaId && { areaId }),
  }

  const [reports, total] = await Promise.all([
    prisma.outageReport.findMany({
      where,
      select: zoneReportSelect,
      orderBy: [{ createdAt: sortOrder }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.outageReport.count({ where }),
  ])

  return { reports, meta: { page, limit, total } }
}

const dismissReport = async (user: AuthUser, id: string, { reason }: DismissReportPayload) => {
  const zoneId = managedZoneId(user)

  const report = await prisma.outageReport.findUnique({
    where: { id },
    select: { status: true, area: { select: { feeder: { select: { zoneId: true } } } } },
  })

  if (!report) {
    throw new AppError(httpStatus.NOT_FOUND, "Report not found")
  }

  if (report.area.feeder.zoneId !== zoneId) {
    throw new AppError(httpStatus.FORBIDDEN, "This report isn't in your zone")
  }

  // Conditional, so a report linked to an outage or dismissed meanwhile is left alone
  const { count } = await prisma.outageReport.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DISMISSED", dismissReason: reason, dismissedById: user.id },
  })

  if (count === 0) {
    const { status } = await prisma.outageReport.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })

    throw new AppError(
      httpStatus.CONFLICT,
      status === "DISMISSED"
        ? "Report is already dismissed"
        : "This report is linked to an outage and can't be dismissed",
    )
  }

  return prisma.outageReport.findUniqueOrThrow({ where: { id }, select: zoneReportSelect })
}

export const outageReportService = { createReport, getMyReports, getZoneReports, dismissReport }
