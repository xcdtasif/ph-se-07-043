import type { Request, Response } from "express"
import httpStatus from "http-status"

import { sendResponse } from "../../utils/send-response.js"
import type { AuditLogQuery } from "./admin.schema.js"
import { adminService } from "./admin.service.js"

const getStats = async (_req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Stats fetched successfully",
    data: await adminService.getStats(),
  })
}

const getAuditLogs = async (req: Request, res: Response) => {
  const { logs, meta } = await adminService.getAuditLogs(req.query as unknown as AuditLogQuery)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Audit logs fetched successfully",
    data: logs,
    meta,
  })
}

export const adminController = { getStats, getAuditLogs }
