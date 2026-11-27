import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { CreateZonePayload, UpdateZonePayload } from "./zone.schema.js"
import { zoneService } from "./zone.service.js"

const getAllZones = async (_req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Zones fetched successfully",
    data: await zoneService.getAllZones(),
  })
}

const createZone = async (req: Request<{}, {}, CreateZonePayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Zone created successfully",
    data: await zoneService.createZone(req.body),
  })
}

const updateZone = async (req: Request<IdParams, {}, UpdateZonePayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Zone updated successfully",
    data: await zoneService.updateZone(req.params.id, req.body),
  })
}

const deleteZone = async (req: Request<IdParams>, res: Response) => {
  await zoneService.deleteZone(requestUser(req).id, req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Zone deleted successfully",
  })
}

export const zoneController = { getAllZones, createZone, updateZone, deleteZone }
