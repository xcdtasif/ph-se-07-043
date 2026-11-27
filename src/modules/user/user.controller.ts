import type { Request, Response } from "express"
import httpStatus from "http-status"

import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import { publicUser } from "../auth/auth.user.js"
import type { UpdateMePayload } from "./user.schema.js"
import { userService } from "./user.service.js"

const getMe = (req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Profile fetched successfully",
    data: publicUser(requestUser(req)),
  })
}

const updateMe = async (req: Request<{}, {}, UpdateMePayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Profile updated successfully",
    data: await userService.updateMe(requestUser(req).id, req.body),
  })
}

export const userController = { getMe, updateMe }
