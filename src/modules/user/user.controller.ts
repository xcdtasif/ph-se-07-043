import type { Request, Response } from "express"
import httpStatus from "http-status"

import { AppError } from "../../utils/app-error.js"
import { sendResponse } from "../../utils/send-response.js"
import { publicUser } from "../auth/auth.user.js"
import type { UpdateMePayload } from "./user.schema.js"
import { userService } from "./user.service.js"

const getMe = (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Profile fetched successfully",
    data: publicUser(req.user),
  })
}

const updateMe = async (req: Request<{}, {}, UpdateMePayload>, res: Response) => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required")
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Profile updated successfully",
    data: await userService.updateMe(req.user.id, req.body),
  })
}

export const userController = { getMe, updateMe }
