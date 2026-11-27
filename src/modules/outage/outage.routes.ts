import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { outageController } from "./outage.controller.js"
import { confirmOutageSchema, outagesQuerySchema } from "./outage.schema.js"

const router = Router()

const zoneManager = [authenticate, authorize("ZONE_MANAGER")]

// Get Outages
router.get("/", validate(outagesQuerySchema, "query"), outageController.getOutages)

// Get Outage
router.get("/:id", validate(idParamsSchema, "params"), outageController.getOutage)

// Confirm Outage
router.post(
  "/",
  ...zoneManager,
  validate(confirmOutageSchema, "body"),
  outageController.confirmOutage,
)

export const outageRouter = router
