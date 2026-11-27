import type { Request, Response } from "express"
import httpStatus from "http-status"

import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { OutageAnalyticsQuery } from "./analytics.schema.js"
import { analyticsService } from "./analytics.service.js"

const getOutageAnalytics = async (req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Outage analytics fetched successfully",
    data: await analyticsService.getOutageAnalytics(
      requestUser(req),
      req.query as unknown as OutageAnalyticsQuery,
    ),
  })
}

export const analyticsController = { getOutageAnalytics }
