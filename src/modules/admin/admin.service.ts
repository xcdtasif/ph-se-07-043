import type { Prisma } from "../../generated/prisma/client.js"
import {
  ApplicationStatus,
  OutageReportStatus,
  OutageStatus,
  PaymentStatus,
} from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { dhakaDate, dhakaDaysFilter } from "../../utils/dhaka-time.js"
import { openWhere } from "../job-posting/job-posting.service.js"
import type { AuditLogQuery } from "./admin.schema.js"

// Every key of an enum, counted, so a chart gets a zero instead of a missing bar
const countBy = <K extends string>(
  keys: readonly K[],
  rows: { key: K; count: number }[],
): Record<K, number> => {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>

  for (const { key, count } of rows) {
    counts[key] = count
  }

  return counts
}

const activeEmployees = (role: "ADMIN" | "ZONE_MANAGER" | "TECHNICIAN") =>
  prisma.employee.count({ where: { role, endedAt: null } })

/*
The company at a glance, as it stands now: users, the grid, outages and reports by status, hiring,
and payments with the fees collected (whole taka)
*/
const getStats = async () => {
  const live = { deletedAt: null }

  const [
    users,
    banned,
    customers,
    technicians,
    zoneManagers,
    admins,
    zones,
    feeders,
    areas,
    outages,
    reports,
    openPostings,
    applications,
    payments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.customer.count(),
    activeEmployees("TECHNICIAN"),
    activeEmployees("ZONE_MANAGER"),
    activeEmployees("ADMIN"),
    prisma.zone.count({ where: live }),
    prisma.feeder.count({ where: live }),
    prisma.area.count({ where: live }),
    prisma.outage.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.outageReport.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.jobPosting.count({ where: { ...live, ...openWhere(dhakaDate()) } }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
  ])

  const outagesByStatus = countBy(
    Object.values(OutageStatus),
    outages.map((row) => ({ key: row.status, count: row._count._all })),
  )

  return {
    users: { total: users, banned, customers, technicians, zoneManagers, admins },
    grid: { zones, feeders, areas },
    outages: {
      active: outages.reduce(
        (sum, row) => (row.status === "RESTORED" ? sum : sum + row._count._all),
        0,
      ),
      byStatus: outagesByStatus,
    },
    reports: countBy(
      Object.values(OutageReportStatus),
      reports.map((row) => ({ key: row.status, count: row._count._all })),
    ),
    hiring: {
      openPostings,
      applications: countBy(
        Object.values(ApplicationStatus),
        applications.map((row) => ({ key: row.status, count: row._count._all })),
      ),
    },
    payments: {
      byStatus: countBy(
        Object.values(PaymentStatus),
        payments.map((row) => ({ key: row.status, count: row._count._all })),
      ),
      collected: payments.find((row) => row.status === "COMPLETED")?._sum.amount ?? 0,
    },
  }
}

// The audit log, newest first, filtered by who acted, what they did, on what, and when
const getAuditLogs = async (query: AuditLogQuery) => {
  const { page, limit, actorId, action, entityType, entityId, from, to } = query

  const where: Prisma.AuditLogWhereInput = {
    ...(actorId && { actorId }),
    ...(action && { action }),
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...((from || to) && { createdAt: dhakaDaysFilter(from, to) }),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        createdAt: true,
        // null when the system acted, e.g. a payment webhook
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, meta: { page, limit, total } }
}

export const adminService = { getStats, getAuditLogs }
