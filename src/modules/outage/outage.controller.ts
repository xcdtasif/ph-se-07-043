import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { ConfirmOutagePayload, OutagesQuery } from "./outage.schema.js"
import { outageService } from "./outage.service.js"

const confirmOutage = async (req: Request<{}, {}, ConfirmOutagePayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Outage confirmed successfully",
    data: await outageService.confirmOutage(requestUser(req), req.body),
  })
}

const getOutages = async (req: Request, res: Response) => {
  const { outages, meta } = await outageService.getOutages(req.query as unknown as OutagesQuery)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Outages fetched successfully",
    data: outages,
    meta,
  })
}

const getOutage = async (req: Request<IdParams>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Outage fetched successfully",
    data: await outageService.getOutage(req.params.id),
  })
}

export const outageController = { confirmOutage, getOutages, getOutage }
