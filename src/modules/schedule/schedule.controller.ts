import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type {
  ConfirmDayPayload,
  CreateSlotPayload,
  ScheduleQuery,
  UpdateSlotPayload,
} from "./schedule.schema.js"
import { scheduleService } from "./schedule.service.js"

const getSchedule = async (req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Schedule fetched successfully",
    data: await scheduleService.getSchedule(req.query as unknown as ScheduleQuery),
  })
}

const createSlot = async (req: Request<{}, {}, CreateSlotPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Slot created successfully",
    data: await scheduleService.createSlot(requestUser(req), req.body),
  })
}

const updateSlot = async (req: Request<IdParams, {}, UpdateSlotPayload>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Slot updated successfully",
    data: await scheduleService.updateSlot(requestUser(req), req.params.id, req.body),
  })
}

const cancelSlot = async (req: Request<IdParams>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Slot cancelled successfully",
    data: await scheduleService.cancelSlot(requestUser(req), req.params.id),
  })
}

const confirmDay = async (req: Request<{}, {}, ConfirmDayPayload>, res: Response) => {
  const result = await scheduleService.confirmDay(requestUser(req), req.body)
  const count = result.slots.length

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: `${count} ${count === 1 ? "slot" : "slots"} confirmed for ${result.date}`,
    data: result,
  })
}

export const scheduleController = { getSchedule, createSlot, updateSlot, cancelSlot, confirmDay }
