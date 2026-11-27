import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { feederController } from "./feeder.controller.js"
import { createFeederSchema, feederListQuerySchema, updateFeederSchema } from "./feeder.schema.js"

const router = Router()

const admin = [authenticate, authorize("ADMIN")]

// Get All Feeders
router.get("/", validate(feederListQuerySchema, "query"), feederController.getAllFeeders)

// Create Feeder
router.post("/", ...admin, validate(createFeederSchema, "body"), feederController.createFeeder)

// Update Feeder
router.patch(
  "/:id",
  ...admin,
  validate(idParamsSchema, "params"),
  validate(updateFeederSchema, "body"),
  feederController.updateFeeder,
)

// Delete Feeder
router.delete("/:id", ...admin, validate(idParamsSchema, "params"), feederController.deleteFeeder)

export const feederRouter = router
