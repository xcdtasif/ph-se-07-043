import z from "zod"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../lib/audit.js"
import { dateSchema, fromBeforeTo } from "../../utils/date-schema.js"

// The audit log, newest first; from and to are Dhaka days
export const auditLogQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    actorId: z.uuid().optional(),
    action: z.enum(AUDIT_ACTIONS).optional(),
    entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
    entityId: z.uuid().optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine(fromBeforeTo)

export type AuditLogQuery = z.output<typeof auditLogQuerySchema>
