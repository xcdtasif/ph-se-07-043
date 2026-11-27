import z from "zod"

import { PaymentStatus } from "../../generated/prisma/enums.js"
import { dateSchema, fromBeforeTo } from "../../utils/date-schema.js"

export const myPaymentsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(PaymentStatus).optional(),
  // The Checkout session id, as the success page's session_id gives it
  sessionId: z.string().trim().min(1).max(255).optional(),
})

export type MyPaymentsQuery = z.output<typeof myPaymentsQuerySchema>

// Every payment, for an admin; from and to are Dhaka days the checkout was opened on
export const adminPaymentsQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.enum(PaymentStatus).optional(),
    // The payer's name or email, or the invoice number
    search: z.string().trim().min(1).max(100).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine(fromBeforeTo)

export type AdminPaymentsQuery = z.output<typeof adminPaymentsQuerySchema>
