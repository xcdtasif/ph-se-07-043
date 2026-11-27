import z from "zod"

import { gridCodeSchema, gridNameSchema } from "../zone/zone.schema.js"

export const feederListQuerySchema = z.strictObject({
  zoneId: z.uuid().optional(),
})

export type FeederListQuery = z.output<typeof feederListQuerySchema>

export const createFeederSchema = z.strictObject({
  zoneId: z.uuid(),
  name: gridNameSchema,
  code: gridCodeSchema,
})

export type CreateFeederPayload = z.output<typeof createFeederSchema>

// A feeder stays in its zone: moving it would move its areas and customers too
export const updateFeederSchema = z
  .strictObject({
    name: gridNameSchema.optional(),
    code: gridCodeSchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Send name, code or both",
  })

export type UpdateFeederPayload = z.output<typeof updateFeederSchema>
