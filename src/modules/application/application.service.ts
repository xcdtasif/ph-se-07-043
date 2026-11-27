import httpStatus from "http-status"

import { Prisma } from "../../generated/prisma/client.js"
import type { ApplicationStatus } from "../../generated/prisma/enums.js"
import { writeAuditLog } from "../../lib/audit.js"
import { deletePdf, uploadPdf } from "../../lib/cloudinary.js"
import { sendMail } from "../../lib/mailer.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { AuthUser } from "../auth/auth.user.js"
import { findManagedPosting, isOpenPosting } from "../job-posting/job-posting.service.js"
import { statusEmailSubject, statusEmailTemplate } from "./application.emails.js"
import {
  REVIEWABLE_STATUSES,
  type ApplyPayload,
  type MyApplicationsQuery,
  type PostingApplicationsQuery,
  type UpdateApplicationStatusPayload,
} from "./application.schema.js"

const CV_FOLDER = "gridline/cvs"

// cvPublicId stays on the server
const applicationSelect = {
  id: true,
  status: true,
  phone: true,
  cvUrl: true,
  createdAt: true,
  updatedAt: true,
  jobPosting: {
    select: {
      id: true,
      title: true,
      role: true,
      applicationFee: true,
      zone: { select: { id: true, name: true, code: true } },
    },
  },
} as const

const postingNotFound = () => new AppError(httpStatus.NOT_FOUND, "Job posting not found")
const postingClosed = () => new AppError(httpStatus.CONFLICT, "This job posting is closed")
const alreadyApplied = () => new AppError(httpStatus.CONFLICT, "You already applied for this job")

/*
Checked before the upload, so a refused application leaves no file behind; checked again under the
posting's lock, since it may close meanwhile. The CV is deleted again if the row isn't saved
*/
const apply = async (user: AuthUser, jobPostingId: string, { phone }: ApplyPayload, cv: Buffer) => {
  // Internal moves aren't handled yet (plan step 28)
  if (user.employee) {
    throw new AppError(httpStatus.FORBIDDEN, "Employees can't apply for jobs")
  }

  const posting = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, deletedAt: null },
    select: {
      status: true,
      deadline: true,
      applications: { where: { userId: user.id }, select: { id: true } },
    },
  })

  if (!posting) {
    throw postingNotFound()
  }

  if (!isOpenPosting(posting)) {
    throw postingClosed()
  }

  if (posting.applications.length > 0) {
    throw alreadyApplied()
  }

  let file: Awaited<ReturnType<typeof uploadPdf>>

  try {
    file = await uploadPdf(cv, CV_FOLDER)
  } catch (err) {
    console.error("CV upload failed", err)
    throw new AppError(httpStatus.BAD_GATEWAY, "Couldn't upload your CV; try again")
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Editing the fee or deleting the posting locks it FOR UPDATE, so they wait for this
      if (!(await lockLiveRow(tx, "job_postings", jobPostingId, "SHARE"))) {
        throw postingNotFound()
      }

      const current = await tx.jobPosting.findUniqueOrThrow({
        where: { id: jobPostingId },
        select: { status: true, deadline: true },
      })

      if (!isOpenPosting(current)) {
        throw postingClosed()
      }

      return tx.application.create({
        data: {
          jobPostingId,
          userId: user.id,
          phone,
          cvUrl: file.url,
          cvPublicId: file.publicId,
        },
        select: applicationSelect,
      })
    })
  } catch (err) {
    await deletePdf(file.publicId).catch((deleteErr: unknown) => {
      console.error("Deleting an unsaved CV failed", file.publicId, deleteErr)
    })

    // Two applications sent at once: the unique index lets one in
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw alreadyApplied()
    }

    throw err
  }
}

const getMyApplications = async (user: AuthUser, query: MyApplicationsQuery) => {
  const { page, limit, status, jobPostingId } = query

  const where: Prisma.ApplicationWhereInput = {
    userId: user.id,
    ...(status && { status }),
    ...(jobPostingId && { jobPostingId }),
  }

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      select: applicationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.application.count({ where }),
  ])

  return { applications, meta: { page, limit, total } }
}

// What a reviewer sees: the applicant, and who made the last decision
const reviewSelect = {
  id: true,
  status: true,
  phone: true,
  cvUrl: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
  employee: { select: { id: true, role: true, zoneId: true } },
  jobPosting: {
    select: {
      id: true,
      title: true,
      role: true,
      vacancies: true,
      zone: { select: { id: true, name: true, code: true } },
    },
  },
} as const

// A posting's paid applications, oldest first, for its poster's role
const getPostingApplications = async (
  user: AuthUser,
  jobPostingId: string,
  query: PostingApplicationsQuery,
) => {
  await findManagedPosting(user, jobPostingId)

  const { page, limit, status } = query

  const where: Prisma.ApplicationWhereInput = {
    jobPostingId,
    status: status ?? { in: [...REVIEWABLE_STATUSES] },
  }

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      select: reviewSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.application.count({ where }),
  ])

  return { applications, meta: { page, limit, total } }
}

// Shortlist or reject a submitted application; hire or reject a shortlisted one
const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  PAYMENT_PENDING: [],
  SUBMITTED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
}

const assertTransition = (from: ApplicationStatus, to: ApplicationStatus) => {
  if (NEXT_STATUSES[from].includes(to)) {
    return
  }

  if (from === "PAYMENT_PENDING") {
    throw new AppError(httpStatus.CONFLICT, "This application's fee isn't paid yet")
  }

  if (from === "HIRED" || from === "REJECTED") {
    throw new AppError(httpStatus.CONFLICT, `This application is already ${from.toLowerCase()}`)
  }

  if (from === to) {
    throw new AppError(httpStatus.CONFLICT, "This application is already shortlisted")
  }

  throw new AppError(httpStatus.CONFLICT, "Shortlist this application before hiring")
}

type ManagedPosting = Awaited<ReturnType<typeof findManagedPosting>>

/*
Creates the hired applicant's Employee, after their application is set to HIRED in the same
transaction. The posting is locked FOR UPDATE, so hires on it run one
at a time against its vacancies (vacancy edits take the same lock), and the zone too, so two
Zone Manager hires for one zone can't both pass the check. The applicant being hired somewhere
else at the same moment is left to the one-active-employee index
*/
const hire = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  applicationId: string,
  userId: string,
  posting: ManagedPosting,
) => {
  if (!(await lockLiveRow(tx, "job_postings", posting.id, "UPDATE"))) {
    throw new AppError(httpStatus.NOT_FOUND, "Job posting not found")
  }

  const { vacancies } = await tx.jobPosting.findUniqueOrThrow({
    where: { id: posting.id },
    select: { vacancies: true },
  })
  // Counts this application too, which is already HIRED in this transaction
  const hired = await tx.application.count({
    where: { jobPostingId: posting.id, status: "HIRED" },
  })

  if (hired > vacancies) {
    throw new AppError(
      httpStatus.CONFLICT,
      vacancies === 1 ? "The vacancy is filled" : `All ${vacancies} vacancies are filled`,
    )
  }

  // A posting with applications can't be deleted, and nor can a zone with live postings
  if (!(await lockLiveRow(tx, "zones", posting.zoneId, "UPDATE"))) {
    throw new AppError(httpStatus.NOT_FOUND, "Zone not found")
  }

  if (posting.role === "ZONE_MANAGER") {
    const manager = await tx.employee.findFirst({
      where: { zoneId: posting.zoneId, role: "ZONE_MANAGER", endedAt: null },
      select: { id: true },
    })

    if (manager) {
      throw new AppError(httpStatus.CONFLICT, "This zone already has a Zone Manager")
    }
  }

  const employee = await tx.employee.findFirst({
    where: { userId, endedAt: null },
    select: { id: true },
  })

  if (employee) {
    throw new AppError(httpStatus.CONFLICT, "This applicant is already an employee")
  }

  const created = await tx.employee.create({
    data: { userId, role: posting.role, zoneId: posting.zoneId, applicationId },
    select: { id: true, role: true, zoneId: true },
  })

  await writeAuditLog(tx, {
    actorId,
    action: "EMPLOYEE_HIRED",
    entityType: "EMPLOYEE",
    entityId: created.id,
    after: { userId, role: created.role, zoneId: created.zoneId, applicationId },
  })
}

/*
Emails the applicant once the change is committed. A notification: a failure is logged and the
change stands
*/
const sendStatusEmail = async (
  application: Prisma.ApplicationGetPayload<{ select: typeof reviewSelect }>,
) => {
  const { status, user, jobPosting } = application

  if (status !== "SHORTLISTED" && status !== "REJECTED" && status !== "HIRED") {
    return
  }

  try {
    await sendMail({
      to: user.email,
      subject: statusEmailSubject(status, jobPosting.title),
      html: statusEmailTemplate({
        name: user.name,
        status,
        jobTitle: jobPosting.title,
        zoneName: jobPosting.zone.name,
      }),
    })
  } catch (err) {
    console.error(`Status email for application ${application.id} failed`, err)
  }
}

/*
Moves an application on, for its posting's poster role. The update only lands if the status is
still the one checked, so two reviewers acting at once can't both change it
*/
const updateApplicationStatus = async (
  user: AuthUser,
  id: string,
  { status }: UpdateApplicationStatusPayload,
) => {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { status: true, userId: true, jobPostingId: true },
  })

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found")
  }

  const posting = await findManagedPosting(user, application.jobPostingId)

  assertTransition(application.status, status)

  let updated

  try {
    updated = await prisma.$transaction(async (tx) => {
      // Locks the row; nothing changes if someone else moved it meanwhile
      const { count } = await tx.application.updateMany({
        where: { id, status: application.status },
        data: { status, reviewedById: user.id },
      })

      if (count === 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This application was just changed by someone else; refresh and try again",
        )
      }

      if (status === "HIRED") {
        await hire(tx, user.id, id, application.userId, posting)
      }

      await writeAuditLog(tx, {
        actorId: user.id,
        action: "APPLICATION_STATUS_CHANGED",
        entityType: "APPLICATION",
        entityId: id,
        before: { status: application.status },
        after: { status },
      })

      return tx.application.findUniqueOrThrow({ where: { id }, select: reviewSelect })
    })
  } catch (err) {
    // The one-active-employee index: hired through another posting meanwhile
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(httpStatus.CONFLICT, "This applicant is already an employee")
    }

    throw err
  }

  await sendStatusEmail(updated)

  return updated
}

export const applicationService = {
  apply,
  getMyApplications,
  getPostingApplications,
  updateApplicationStatus,
}
