import z from "zod"

// Shared by zones, feeders and areas
export const gridNameSchema = z.string().trim().min(2).max(100)

// Zone and feeder codes, stored uppercase, like MIR or MIR-F01
export const gridCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(20)
  .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, {
    error: "Use letters, digits and single hyphens, like MIR-F01",
  })

export const createZoneSchema = z.strictObject({
  name: gridNameSchema,
  code: gridCodeSchema,
})

export type CreateZonePayload = z.output<typeof createZoneSchema>

export const updateZoneSchema = z
  .strictObject({
    name: gridNameSchema.optional(),
    code: gridCodeSchema.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Send name, code or both",
  })

export type UpdateZonePayload = z.output<typeof updateZoneSchema>
