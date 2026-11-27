import z from "zod"

const meterNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, { error: "Meter number must be 12 digits" })

export const createCustomerSchema = z.strictObject({
  areaId: z.uuid(),
  meterNumber: meterNumberSchema.optional(),
})

export type CreateCustomerPayload = z.output<typeof createCustomerSchema>

// null clears the meter number
export const updateCustomerSchema = z
  .strictObject({
    areaId: z.uuid().optional(),
    meterNumber: meterNumberSchema.nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Send areaId, meterNumber or both",
  })

export type UpdateCustomerPayload = z.output<typeof updateCustomerSchema>
