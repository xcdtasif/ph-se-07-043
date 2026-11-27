import z from "zod"

// A calendar date in a query, like 2026-11-28; ranges of them are Dhaka days
export const dateSchema = z.iso.date({ error: "Use a date like 2026-11-28" })

// For a query's optional from and to: when both are sent, to can't come before from
export const fromBeforeTo = (
  { from, to }: { from?: string | undefined; to?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (from && to && to < from) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Must be on or after from" })
  }
}
