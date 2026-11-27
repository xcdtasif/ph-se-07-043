import z from "zod"

import { ApplicationStatus } from "../../generated/prisma/enums.js"

// The CV comes as the form's cv file; name and email come from the account
export const applySchema = z.strictObject({
  // Spaces, dashes and a +88 prefix are dropped, so it's stored as 01XXXXXXXXX
  phone: z
    .string()
    .trim()
    .transform((phone) => phone.replace(/[\s-]/g, "").replace(/^\+?88(?=01)/, ""))
    .pipe(
      z.string().regex(/^01[3-9]\d{8}$/, {
        error: "Use a number like 01712345678",
      }),
    ),
})

export type ApplyPayload = z.output<typeof applySchema>

export const myApplicationsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(ApplicationStatus).optional(),
  // A job page shows the user's application for that posting
  jobPostingId: z.uuid().optional(),
})

export type MyApplicationsQuery = z.output<typeof myApplicationsQuerySchema>
