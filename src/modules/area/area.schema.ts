import z from "zod"

import { gridNameSchema } from "../zone/zone.schema.js"

export const areaListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  zoneId: z.uuid().optional(),
  feederId: z.uuid().optional(),
})

export type AreaListQuery = z.output<typeof areaListQuerySchema>

export const createAreaSchema = z.strictObject({
  feederId: z.uuid(),
  name: gridNameSchema,
})

export type CreateAreaPayload = z.output<typeof createAreaSchema>

// An area stays on its feeder: moving it would change its customers' schedules and outages
export const updateAreaSchema = z.strictObject({
  name: gridNameSchema,
})

export type UpdateAreaPayload = z.output<typeof updateAreaSchema>
