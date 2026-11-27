import type { Prisma } from "../generated/prisma/client.js"

// Each step that audits a new action adds it here; GET /admin/audit-logs filters by these
export const AUDIT_ACTIONS = [
  "USER_BANNED",
  "USER_UNBANNED",
  "ZONE_DELETED",
  "FEEDER_DELETED",
  "AREA_DELETED",
  "SLOT_CANCELLED",
  "SCHEDULE_DAY_CONFIRMED",
  "OUTAGE_CONFIRMED",
  "OUTAGE_ASSIGNED",
  "OUTAGE_STATUS_CHANGED",
  "EMPLOYMENT_ENDED",
  "PAYMENT_COMPLETED",
] as const
export const AUDIT_ENTITY_TYPES = [
  "USER",
  "ZONE",
  "FEEDER",
  "AREA",
  "SLOT",
  "OUTAGE",
  "EMPLOYEE",
  "PAYMENT",
] as const

type AuditEntry = {
  // null when the system acted, e.g. a payment webhook
  actorId: string | null
  action: (typeof AUDIT_ACTIONS)[number]
  entityType: (typeof AUDIT_ENTITY_TYPES)[number]
  entityId: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}

/*
Takes the transaction client, not prisma, so the log is written in the same transaction as the
change it records: both are saved or neither is
*/
export const writeAuditLog = (tx: Prisma.TransactionClient, entry: AuditEntry) =>
  tx.auditLog.create({ data: entry })
