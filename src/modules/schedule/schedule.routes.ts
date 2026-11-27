import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { scheduleController } from "./schedule.controller.js"
import {
  confirmDaySchema,
  createSlotSchema,
  scheduleQuerySchema,
  updateSlotSchema,
} from "./schedule.schema.js"

const router = Router()

const zoneManager = [authenticate, authorize("ZONE_MANAGER")]

// Get Schedule
router.get("/", validate(scheduleQuerySchema, "query"), scheduleController.getSchedule)

// Create Slot
router.post("/", ...zoneManager, validate(createSlotSchema, "body"), scheduleController.createSlot)

// Confirm Day
router.post(
  "/confirm",
  ...zoneManager,
  validate(confirmDaySchema, "body"),
  scheduleController.confirmDay,
)

// Update Slot
router.patch(
  "/:id",
  ...zoneManager,
  validate(idParamsSchema, "params"),
  validate(updateSlotSchema, "body"),
  scheduleController.updateSlot,
)

// Cancel Slot
router.patch(
  "/:id/cancel",
  ...zoneManager,
  validate(idParamsSchema, "params"),
  scheduleController.cancelSlot,
)

export const scheduleRouter = router
