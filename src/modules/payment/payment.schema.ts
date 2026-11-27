import z from "zod"

import { PaymentStatus } from "../../generated/prisma/enums.js"

export const myPaymentsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(PaymentStatus).optional(),
  // The Checkout session id, as the success page's session_id gives it
  sessionId: z.string().trim().min(1).max(255).optional(),
})

export type MyPaymentsQuery = z.output<typeof myPaymentsQuerySchema>
