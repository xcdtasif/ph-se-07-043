import type { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { logCount } from "../utils/log-count.js"

const HOUR_MS = 60 * 60 * 1000

type SeedLog = Prisma.AuditLogCreateManyInput

const hoursAfter = (date: Date, hours: number) => new Date(date.getTime() + hours * HOUR_MS)

// What the outage service would have logged, each at the time it happened
const outageLogs = async (): Promise<SeedLog[]> => {
  const outages = await prisma.outage.findMany({
    where: { NOT: { id: { in: await loggedIds("OUTAGE", "OUTAGE_CONFIRMED") } } },
    select: {
      id: true,
      zoneId: true,
      status: true,
      cause: true,
      confirmedById: true,
      confirmedAt: true,
      assignedAt: true,
      startedAt: true,
      restoredAt: true,
      technicianId: true,
      technician: { select: { userId: true } },
      areas: { select: { areaId: true } },
      reports: { select: { id: true } },
    },
  })

  return outages.flatMap((outage) => {
    const { id, technicianId, technician, assignedAt, startedAt, restoredAt, cause } = outage
    const logs: SeedLog[] = [
      {
        actorId: outage.confirmedById,
        action: "OUTAGE_CONFIRMED",
        entityType: "OUTAGE",
        entityId: id,
        after: {
          zoneId: outage.zoneId,
          areaIds: outage.areas.map((area) => area.areaId),
          reportIds: outage.reports.map((report) => report.id),
        },
        createdAt: outage.confirmedAt,
      },
    ]

    if (!assignedAt || !technicianId || !technician) {
      return logs
    }

    logs.push({
      actorId: outage.confirmedById,
      action: "OUTAGE_ASSIGNED",
      entityType: "OUTAGE",
      entityId: id,
      before: { status: "CONFIRMED", technicianId: null },
      after: { status: "ASSIGNED", technicianId },
      createdAt: assignedAt,
    })

    // The technician may set the cause when starting work; a restored outage's is set on restoring
    if (startedAt) {
      logs.push({
        actorId: technician.userId,
        action: "OUTAGE_STATUS_CHANGED",
        entityType: "OUTAGE",
        entityId: id,
        before: { status: "ASSIGNED", cause: null },
        after: { status: "IN_PROGRESS", cause: restoredAt ? null : cause },
        createdAt: startedAt,
      })
    }

    if (restoredAt) {
      logs.push({
        actorId: technician.userId,
        action: "OUTAGE_STATUS_CHANGED",
        entityType: "OUTAGE",
        entityId: id,
        before: { status: startedAt ? "IN_PROGRESS" : "ASSIGNED", cause: null },
        after: { status: "RESTORED", cause },
        createdAt: restoredAt,
      })
    }

    return logs
  })
}

// Completed payments, logged by the webhook with no actor
const paymentLogs = async (): Promise<SeedLog[]> => {
  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      NOT: { id: { in: await loggedIds("PAYMENT", "PAYMENT_COMPLETED") } },
    },
    select: { id: true, paidAt: true, invoiceNumber: true },
  })

  return payments.flatMap(({ id, paidAt, invoiceNumber }) =>
    paidAt
      ? [
          {
            actorId: null,
            action: "PAYMENT_COMPLETED",
            entityType: "PAYMENT",
            entityId: id,
            before: { status: "PENDING" },
            after: { status: "COMPLETED", paidAt: paidAt.toISOString(), invoiceNumber },
            createdAt: paidAt,
          },
        ]
      : [],
  )
}

/*
Reviews, a few hours after the fee was paid: shortlisting or rejecting, and a hire after a
shortlist, with the employee it created
*/
const applicationLogs = async (): Promise<SeedLog[]> => {
  const applications = await prisma.application.findMany({
    where: {
      status: { in: ["SHORTLISTED", "HIRED", "REJECTED"] },
      reviewedById: { not: null },
      NOT: { id: { in: await loggedIds("APPLICATION", "APPLICATION_STATUS_CHANGED") } },
    },
    select: {
      id: true,
      status: true,
      userId: true,
      reviewedById: true,
      payments: {
        where: { status: "COMPLETED" },
        select: { paidAt: true },
        orderBy: { paidAt: "desc" },
        take: 1,
      },
      employee: { select: { id: true, role: true, zoneId: true } },
    },
  })

  return applications.flatMap((application) => {
    const { id, status, reviewedById, employee } = application
    const paidAt = application.payments[0]?.paidAt

    if (!paidAt) {
      return []
    }

    const review = (from: string, to: string, hours: number): SeedLog => ({
      actorId: reviewedById,
      action: "APPLICATION_STATUS_CHANGED",
      entityType: "APPLICATION",
      entityId: id,
      before: { status: from },
      after: { status: to },
      createdAt: hoursAfter(paidAt, hours),
    })

    if (status !== "HIRED") {
      return [review("SUBMITTED", status, 3)]
    }

    const logs = [review("SUBMITTED", "SHORTLISTED", 3), review("SHORTLISTED", "HIRED", 6)]

    if (employee) {
      logs.push({
        actorId: reviewedById,
        action: "EMPLOYEE_HIRED",
        entityType: "EMPLOYEE",
        entityId: employee.id,
        after: {
          userId: application.userId,
          role: employee.role,
          zoneId: employee.zoneId,
          applicationId: id,
        },
        createdAt: hoursAfter(paidAt, 6),
      })
    }

    return logs
  })
}

// Banned users, banned by Admin 01 when they were created
const banLogs = async (): Promise<SeedLog[]> => {
  const admin = await prisma.employee.findFirst({
    where: { role: "ADMIN", endedAt: null },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  })

  if (!admin) {
    return []
  }

  const users = await prisma.user.findMany({
    where: { isBanned: true, NOT: { id: { in: await loggedIds("USER", "USER_BANNED") } } },
    select: { id: true, createdAt: true },
  })

  return users.map((user) => ({
    actorId: admin.userId,
    action: "USER_BANNED",
    entityType: "USER",
    entityId: user.id,
    before: { isBanned: false },
    after: { isBanned: true },
    createdAt: user.createdAt,
  }))
}

// The entities that already have this action in the log
const loggedIds = async (entityType: string, action: string) => {
  const logs = await prisma.auditLog.findMany({
    where: { entityType, action },
    select: { entityId: true },
    distinct: ["entityId"],
  })

  return logs.map((log) => log.entityId)
}

/*
The seeders write rows directly, skipping the services that log each change, so this fills in the
audit trail the services would have written. Safe to run again: an entity whose first action is
already logged is skipped, and anything made through the API has its own logs
*/
export const seedAuditLogs = async () => {
  const logs = [
    ...(await outageLogs()),
    ...(await paymentLogs()),
    ...(await applicationLogs()),
    ...(await banLogs()),
  ]

  const { count } = await prisma.auditLog.createMany({ data: logs })

  logCount(count, "audit log", "audit logs", "seeded")
}
