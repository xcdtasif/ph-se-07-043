import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { CreateFeederPayload, FeederListQuery, UpdateFeederPayload } from "./feeder.schema.js"
import { feederService } from "./feeder.service.js"

const getAllFeeders = async (req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Feeders fetched successfully",
    data: await feederService.getAllFeeders(req.query as FeederListQuery),
  })
}

const createFeeder = async (req: Request<{}, {}, CreateFeederPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Feeder created successfully",
    data: await feederService.createFeeder(req.body),
  })
}

const updateFeeder = async (req: Request<IdParams, {}, UpdateFeederPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Feeder updated successfully",
    data: await feederService.updateFeeder(req.params.id, req.body),
  })
}

const deleteFeeder = async (req: Request<IdParams>, res: Response) => {
  await feederService.deleteFeeder(requestUser(req).id, req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Feeder deleted successfully",
  })
}

export const feederController = { getAllFeeders, createFeeder, updateFeeder, deleteFeeder }
