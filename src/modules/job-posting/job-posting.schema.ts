import z from "zod"

import { EmployeeRole, JobPostingStatus } from "../../generated/prisma/enums.js"
import { dhakaDate } from "../../utils/dhaka-time.js"

// How far ahead a deadline can be
const MAX_DEADLINE_DAYS = 90

// A Dhaka calendar day, from today to 90 days ahead; applying closes when it ends
const deadlineSchema = z.iso
  .date({ error: "Use a date like 2026-12-31" })
  .refine((date) => date >= dhakaDate(), { error: "Must be today or later (Dhaka time)" })
  .refine((date) => date <= dhakaDate(MAX_DEADLINE_DAYS), {
    error: `Must be within ${MAX_DEADLINE_DAYS} days`,
  })

const postingFields = {
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  // A Zone Manager posting has one; the service checks that
  vacancies: z.int().min(1).max(50),
  // Whole taka; 100 keeps it above Stripe's smallest charge
  applicationFee: z.int().min(100).max(10_000),
  deadline: deadlineSchema,
}

/*
The poster's role sets the posting's: a Zone Manager posts TECHNICIAN jobs for their own zone,
an admin posts ZONE_MANAGER jobs and names the zone
*/
export const createJobPostingSchema = z.strictObject({
  ...postingFields,
  zoneId: z.uuid().optional(),
  vacancies: postingFields.vacancies.default(1),
})

export type CreateJobPostingPayload = z.output<typeof createJobPostingSchema>

// The zone and role stay; status closes or reopens it
export const updateJobPostingSchema = z
  .strictObject({
    title: postingFields.title.optional(),
    description: postingFields.description.optional(),
    vacancies: postingFields.vacancies.optional(),
    applicationFee: postingFields.applicationFee.optional(),
    deadline: postingFields.deadline.optional(),
    status: z.enum(JobPostingStatus).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    error: "Send at least one field to change",
  })

export type UpdateJobPostingPayload = z.output<typeof updateJobPostingSchema>

// status is the one applicants see: CLOSED covers a passed deadline too
export const jobPostingListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  zoneId: z.uuid().optional(),
  role: z.enum([EmployeeRole.TECHNICIAN, EmployeeRole.ZONE_MANAGER]).optional(),
  status: z.enum(JobPostingStatus).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(["createdAt", "deadline", "applicationFee"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export type JobPostingListQuery = z.output<typeof jobPostingListQuerySchema>
