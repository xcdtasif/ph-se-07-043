import type { Request, Response } from "express"
import httpStatus from "http-status"

import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { CreateCustomerPayload, UpdateCustomerPayload } from "./customer.schema.js"
import { customerService } from "./customer.service.js"

const createMe = async (req: Request<{}, {}, CreateCustomerPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Customer profile created successfully",
    data: await customerService.createMe(requestUser(req).id, req.body),
  })
}

const updateMe = async (req: Request<{}, {}, UpdateCustomerPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Customer profile updated successfully",
    data: await customerService.updateMe(requestUser(req).id, req.body),
  })
}

export const customerController = { createMe, updateMe }
