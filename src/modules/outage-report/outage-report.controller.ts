import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type {
  CreateReportPayload,
  DismissReportPayload,
  MyReportsQuery,
  ZoneReportsQuery,
} from "./outage-report.schema.js"
import { outageReportService } from "./outage-report.service.js"

const createReport = async (req: Request<{}, {}, CreateReportPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Outage reported successfully",
    data: await outageReportService.createReport(requestUser(req), req.body),
  })
}

const getMyReports = async (req: Request, res: Response) => {
  const { reports, meta } = await outageReportService.getMyReports(
    requestUser(req),
    req.query as unknown as MyReportsQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Reports fetched successfully",
    data: reports,
    meta,
  })
}

const getZoneReports = async (req: Request, res: Response) => {
  const { reports, meta } = await outageReportService.getZoneReports(
    requestUser(req),
    req.query as unknown as ZoneReportsQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Reports fetched successfully",
    data: reports,
    meta,
  })
}

const dismissReport = async (req: Request<IdParams, {}, DismissReportPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Report dismissed successfully",
    data: await outageReportService.dismissReport(requestUser(req), req.params.id, req.body),
  })
}

export const outageReportController = { createReport, getMyReports, getZoneReports, dismissReport }
