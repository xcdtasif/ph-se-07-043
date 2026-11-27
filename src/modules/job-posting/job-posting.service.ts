import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { bumpCache, cached } from "../../lib/cache.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { dhakaDate } from "../../utils/dhaka-time.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import { managedZoneId } from "../../utils/managed-zone.js"
import type { AuthUser } from "../auth/auth.user.js"
import type {
  CreateJobPostingPayload,
  JobPostingListQuery,
  UpdateJobPostingPayload,
} from "./job-posting.schema.js"

const postingSelect = {
  id: true,
  role: true,
  title: true,
  description: true,
  vacancies: true,
  applicationFee: true,
  deadline: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  zone: { select: { id: true, name: true, code: true } },
} as const

type SelectedPosting = Prisma.JobPostingGetPayload<{ select: typeof postingSelect }>

// A deadline is stored as a date, which Prisma reads as midnight UTC
const toDateValue = (date: string) => new Date(`${date}T00:00:00Z`)
const toDateString = (date: Date) => date.toISOString().slice(0, 10)

// Open means applicants can still apply: not closed, and the deadline day hasn't ended in Dhaka
export const openWhere = (today: string): Prisma.JobPostingWhereInput => ({
  status: "OPEN",
  deadline: { gte: toDateValue(today) },
})

const closedWhere = (today: string): Prisma.JobPostingWhereInput => ({
  OR: [{ status: "CLOSED" }, { deadline: { lt: toDateValue(today) } }],
})

// Applicants can still apply: not closed, and the deadline day hasn't ended in Dhaka
export const isOpenPosting = (
  posting: { status: "OPEN" | "CLOSED"; deadline: Date },
  today = dhakaDate(),
) => posting.status === "OPEN" && toDateString(posting.deadline) >= today

// The status applicants see, and the deadline as the date it was set as
const toPosting = (posting: SelectedPosting, today = dhakaDate()) => ({
  ...posting,
  deadline: toDateString(posting.deadline),
  status: isOpenPosting(posting, today) ? ("OPEN" as const) : ("CLOSED" as const),
})

const postingNotFound = () => new AppError(httpStatus.NOT_FOUND, "Job posting not found")

// Zone Managers hire technicians; admins hire Zone Managers
const postedRole = (user: AuthUser) =>
  user.employee?.role === "ADMIN" ? ("ZONE_MANAGER" as const) : ("TECHNICIAN" as const)

const oneVacancyError = () =>
  new AppError(httpStatus.BAD_REQUEST, "A zone has one Zone Manager", [
    { path: "vacancies", message: "A Zone Manager posting has one vacancy" },
  ])

/*
Cached per Dhaka day too, since the status depends on it. The list is cached as it's sent:
toPosting runs before caching
*/
const getJobPostings = (query: JobPostingListQuery) => {
  const today = dhakaDate()

  return cached("jobs", `list:${today}:${JSON.stringify(query)}`, async () => {
    const { page, limit, zoneId, role, status, search, sortBy, sortOrder } = query

    const where: Prisma.JobPostingWhereInput = {
      deletedAt: null,
      ...(zoneId && { zoneId }),
      ...(role && { role }),
      ...(status === "OPEN" && openWhere(today)),
      ...(status === "CLOSED" && closedWhere(today)),
      ...(search && {
        AND: [
          {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          },
        ],
      }),
    }

    const [postings, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        select: postingSelect,
        orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.jobPosting.count({ where }),
    ])

    return {
      postings: postings.map((posting) => toPosting(posting, today)),
      meta: { page, limit, total },
    }
  })
}

const getJobPosting = (id: string) => {
  const today = dhakaDate()

  return cached("jobs", `one:${today}:${id}`, async () => {
    const posting = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null },
      select: postingSelect,
    })

    if (!posting) {
      throw postingNotFound()
    }

    return toPosting(posting, today)
  })
}

const createJobPosting = async (user: AuthUser, payload: CreateJobPostingPayload) => {
  const role = postedRole(user)
  const { zoneId: requestedZoneId, deadline, ...fields } = payload
  let zoneId: string

  if (role === "TECHNICIAN") {
    zoneId = managedZoneId(user)

    if (requestedZoneId && requestedZoneId !== zoneId) {
      throw new AppError(httpStatus.FORBIDDEN, "You can only post jobs for your own zone")
    }
  } else {
    if (!requestedZoneId) {
      throw new AppError(httpStatus.BAD_REQUEST, "Choose the zone this Zone Manager will run", [
        { path: "zoneId", message: "Required" },
      ])
    }

    if (fields.vacancies !== 1) {
      throw oneVacancyError()
    }

    zoneId = requestedZoneId
  }

  const posting = await prisma.$transaction(async (tx) => {
    // Holds the zone until the posting is saved, so the zone can't be deleted meanwhile
    if (!(await lockLiveRow(tx, "zones", zoneId, "SHARE"))) {
      throw new AppError(httpStatus.NOT_FOUND, "Zone not found", [
        { path: "zoneId", message: "Zone not found" },
      ])
    }

    return tx.jobPosting.create({
      data: { ...fields, zoneId, role, deadline: toDateValue(deadline), createdById: user.id },
      select: postingSelect,
    })
  })
  await bumpCache("jobs")

  return toPosting(posting)
}

/*
The live posting, if this user manages it: a Zone Manager their zone's technician postings, an
admin every Zone Manager posting
*/
export const findManagedPosting = async (user: AuthUser, id: string) => {
  const posting = await prisma.jobPosting.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, zoneId: true, status: true, deadline: true },
  })

  if (!posting) {
    throw postingNotFound()
  }

  if (postedRole(user) === "ZONE_MANAGER") {
    if (posting.role !== "ZONE_MANAGER") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Technician postings are managed by their zone's Zone Manager",
      )
    }
  } else if (posting.role !== "TECHNICIAN") {
    throw new AppError(httpStatus.FORBIDDEN, "Zone Manager postings are managed by admins")
  } else if (posting.zoneId !== managedZoneId(user)) {
    throw new AppError(httpStatus.FORBIDDEN, "This job posting isn't in your zone")
  }

  return posting
}

const updateJobPosting = async (user: AuthUser, id: string, payload: UpdateJobPostingPayload) => {
  const posting = await findManagedPosting(user, id)
  const { deadline, ...fields } = payload

  if (posting.role === "ZONE_MANAGER" && fields.vacancies !== undefined && fields.vacancies !== 1) {
    throw oneVacancyError()
  }

  // A new deadline is checked by the schema; reopening on the old one needs it not to have passed
  if (
    fields.status === "OPEN" &&
    deadline === undefined &&
    toDateString(posting.deadline) < dhakaDate()
  ) {
    throw new AppError(httpStatus.CONFLICT, "The deadline has passed; set a new one to reopen", [
      { path: "deadline", message: "Set a deadline from today on" },
    ])
  }

  await prisma.$transaction(async (tx) => {
    // Applying holds the posting FOR SHARE, so the check below sees every application
    if (!(await lockLiveRow(tx, "job_postings", id, "UPDATE"))) {
      throw postingNotFound()
    }

    if (fields.applicationFee !== undefined) {
      const current = await tx.jobPosting.findUniqueOrThrow({
        where: { id },
        select: { applicationFee: true, _count: { select: { applications: true } } },
      })

      // Everyone applies at the same fee
      if (current.applicationFee !== fields.applicationFee && current._count.applications > 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          "People have applied at this fee; close this posting and post a new one to change it",
        )
      }
    }

    // Hiring holds this lock too, so the count can't grow before the update
    if (fields.vacancies !== undefined) {
      const hired = await tx.application.count({ where: { jobPostingId: id, status: "HIRED" } })

      if (fields.vacancies < hired) {
        throw new AppError(
          httpStatus.CONFLICT,
          `Vacancies can't go below the ${hired} already hired`,
          [{ path: "vacancies", message: `At least ${hired}` }],
        )
      }
    }

    await tx.jobPosting.update({
      where: { id },
      data: {
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.vacancies !== undefined && { vacancies: fields.vacancies }),
        ...(fields.applicationFee !== undefined && { applicationFee: fields.applicationFee }),
        ...(fields.status !== undefined && { status: fields.status }),
        ...(deadline !== undefined && { deadline: toDateValue(deadline) }),
      },
    })
  })

  await bumpCache("jobs")

  return toPosting(
    await prisma.jobPosting.findUniqueOrThrow({ where: { id }, select: postingSelect }),
  )
}

/*
Soft delete: the posting leaves every list. One with applications stays, since its applicants paid
and follow it in their dashboard; closing it stops new ones
*/
const deleteJobPosting = async (user: AuthUser, id: string) => {
  await findManagedPosting(user, id)

  await prisma.$transaction(async (tx) => {
    // Applying holds the posting FOR SHARE, so an application can't slip in after the count
    if (!(await lockLiveRow(tx, "job_postings", id, "UPDATE"))) {
      throw postingNotFound()
    }

    if ((await tx.application.count({ where: { jobPostingId: id } })) > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This posting has applications; close it instead of deleting it",
      )
    }

    await tx.jobPosting.update({ where: { id }, data: { deletedAt: new Date() } })
  })

  await bumpCache("jobs")
}

export const jobPostingService = {
  getJobPostings,
  getJobPosting,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
}
