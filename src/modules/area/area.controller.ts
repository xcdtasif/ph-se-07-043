import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { AreaListQuery, CreateAreaPayload, UpdateAreaPayload } from "./area.schema.js"
import { areaService } from "./area.service.js"

const getAllAreas = async (req: Request, res: Response) => {
  const { areas, meta } = await areaService.getAllAreas(req.query as unknown as AreaListQuery)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Areas fetched successfully",
    data: areas,
    meta,
  })
}

const createArea = async (req: Request<{}, {}, CreateAreaPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Area created successfully",
    data: await areaService.createArea(req.body),
  })
}

const updateArea = async (req: Request<IdParams, {}, UpdateAreaPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Area updated successfully",
    data: await areaService.updateArea(req.params.id, req.body),
  })
}

const deleteArea = async (req: Request<IdParams>, res: Response) => {
  await areaService.deleteArea(requestUser(req).id, req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Area deleted successfully",
  })
}

export const areaController = { getAllAreas, createArea, updateArea, deleteArea }
