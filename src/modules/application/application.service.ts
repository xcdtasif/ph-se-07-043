import httpStatus from "http-status"

import { Prisma } from "../../generated/prisma/client.js"
import { deletePdf, uploadPdf } from "../../lib/cloudinary.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockLiveRow } from "../../utils/lock-live-row.js"
import type { AuthUser } from "../auth/auth.user.js"
import { isOpenPosting } from "../job-posting/job-posting.service.js"
import type { ApplyPayload, MyApplicationsQuery } from "./application.schema.js"

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

const getMyApplications = async (user: AuthUser, { page, limit, status }: MyApplicationsQuery) => {
  const where: Prisma.ApplicationWhereInput = { userId: user.id, ...(status && { status }) }

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

export const applicationService = { apply, getMyApplications }
