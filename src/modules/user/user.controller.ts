import type { Request, Response } from "express"
import httpStatus from "http-status"

import { AppError } from "../../utils/app-error.js"
import { sendResponse } from "../../utils/send-response.js"
import { publicUser } from "../auth/auth.user.js"

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

export const userController = { getMe }
