import type { Request, Response } from "express"
import httpStatus from "http-status"

import { AppError } from "../../utils/app-error.js"
import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { ApplyPayload, MyApplicationsQuery } from "./application.schema.js"
import { applicationService } from "./application.service.js"

// Only for handlers behind uploadCv, which refuses a request without one
const requestCv = (req: Request<any, any, any, any>) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "Attach your CV as a PDF")
  }

  return req.file.buffer
}

const apply = async (req: Request<IdParams, {}, ApplyPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Application created; pay the fee to submit it",
    data: await applicationService.apply(requestUser(req), req.params.id, req.body, requestCv(req)),
  })
}

const getMyApplications = async (req: Request, res: Response) => {
  const { applications, meta } = await applicationService.getMyApplications(
    requestUser(req),
    req.query as unknown as MyApplicationsQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Applications fetched successfully",
    data: applications,
    meta,
  })
}

export const applicationController = { apply, getMyApplications }
