import z from "zod"

export const nameSchema = z.string().trim().min(2).max(100)

export const updateMeSchema = z.strictObject({
  name: nameSchema,
})

export type UpdateMePayload = z.output<typeof updateMeSchema>
