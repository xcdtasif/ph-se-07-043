import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type {
  CreateJobPostingPayload,
  JobPostingListQuery,
  UpdateJobPostingPayload,
} from "./job-posting.schema.js"
import { jobPostingService } from "./job-posting.service.js"

const getJobPostings = async (req: Request, res: Response) => {
  const { postings, meta } = await jobPostingService.getJobPostings(
    req.query as unknown as JobPostingListQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Job postings fetched successfully",
    data: postings,
    meta,
  })
}

const getJobPosting = async (req: Request<IdParams>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Job posting fetched successfully",
    data: await jobPostingService.getJobPosting(req.params.id),
  })
}

const createJobPosting = async (req: Request<{}, {}, CreateJobPostingPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Job posting created successfully",
    data: await jobPostingService.createJobPosting(requestUser(req), req.body),
  })
}

const updateJobPosting = async (
  req: Request<IdParams, {}, UpdateJobPostingPayload>,
  res: Response,
) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Job posting updated successfully",
    data: await jobPostingService.updateJobPosting(requestUser(req), req.params.id, req.body),
  })
}

const deleteJobPosting = async (req: Request<IdParams>, res: Response) => {
  await jobPostingService.deleteJobPosting(requestUser(req), req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Job posting deleted successfully",
  })
}

export const jobPostingController = {
  getJobPostings,
  getJobPosting,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
}
