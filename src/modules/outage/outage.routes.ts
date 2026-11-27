import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { outageController } from "./outage.controller.js"
import {
  assignedOutagesQuerySchema,
  assignOutageSchema,
  confirmOutageSchema,
  outagesQuerySchema,
  updateOutageStatusSchema,
} from "./outage.schema.js"

const router = Router()

const zoneManager = [authenticate, authorize("ZONE_MANAGER")]
const technician = [authenticate, authorize("TECHNICIAN")]

// Get Outages
router.get("/", validate(outagesQuerySchema, "query"), outageController.getOutages)

// Get Assigned Outages (before /:id, which would take "assigned" as an id)
router.get(
  "/assigned",
  ...technician,
  validate(assignedOutagesQuerySchema, "query"),
  outageController.getAssignedOutages,
)

// Get Outage
router.get("/:id", validate(idParamsSchema, "params"), outageController.getOutage)

// Confirm Outage
router.post(
  "/",
  ...zoneManager,
  validate(confirmOutageSchema, "body"),
  outageController.confirmOutage,
)

// Assign Technician
router.patch(
  "/:id/assign",
  ...zoneManager,
  validate(idParamsSchema, "params"),
  validate(assignOutageSchema, "body"),
  outageController.assignOutage,
)

// Update Outage Status
router.patch(
  "/:id/status",
  ...technician,
  validate(idParamsSchema, "params"),
  validate(updateOutageStatusSchema, "body"),
  outageController.updateOutageStatus,
)

export const outageRouter = router
