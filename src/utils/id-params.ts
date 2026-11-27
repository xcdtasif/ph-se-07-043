import z from "zod"

// The :id path param of a single-resource route
export const idParamsSchema = z.strictObject({
  id: z.uuid(),
})

export type IdParams = z.output<typeof idParamsSchema>
