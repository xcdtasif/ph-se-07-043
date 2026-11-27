import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { zoneController } from "./zone.controller.js"
import { createZoneSchema, updateZoneSchema } from "./zone.schema.js"

const router = Router()

const admin = [authenticate, authorize("ADMIN")]

// Get All Zones
router.get("/", zoneController.getAllZones)

// Create Zone
router.post("/", ...admin, validate(createZoneSchema, "body"), zoneController.createZone)

// Update Zone
router.patch(
  "/:id",
  ...admin,
  validate(idParamsSchema, "params"),
  validate(updateZoneSchema, "body"),
  zoneController.updateZone,
)

// Delete Zone
router.delete("/:id", ...admin, validate(idParamsSchema, "params"), zoneController.deleteZone)

export const zoneRouter = router
