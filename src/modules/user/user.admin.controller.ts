import type { Request, Response } from "express"
import httpStatus from "http-status"

import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { BanUserPayload, UserIdParams, UserListQuery } from "./user.admin.schema.js"
import { adminUserService } from "./user.admin.service.js"

const getAllUsers = async (req: Request, res: Response) => {
  const { users, meta } = await adminUserService.getAllUsers(req.query as unknown as UserListQuery)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Users fetched successfully",
    data: users,
    meta,
  })
}

const banUser = async (req: Request<UserIdParams, {}, BanUserPayload>, res: Response) => {
  const user = await adminUserService.banUser(requestUser(req).id, req.params.id, req.body)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: req.body.isBanned ? "User banned successfully" : "User unbanned successfully",
    data: user,
  })
}

export const adminUserController = { getAllUsers, banUser }
