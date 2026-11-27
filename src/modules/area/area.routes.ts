import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { areaController } from "./area.controller.js"
import { createAreaSchema, areaListQuerySchema, updateAreaSchema } from "./area.schema.js"

const router = Router()

const admin = [authenticate, authorize("ADMIN")]

// Get All Areas
router.get("/", validate(areaListQuerySchema, "query"), areaController.getAllAreas)

// Create Area
router.post("/", ...admin, validate(createAreaSchema, "body"), areaController.createArea)

// Update Area
router.patch(
  "/:id",
  ...admin,
  validate(idParamsSchema, "params"),
  validate(updateAreaSchema, "body"),
  areaController.updateArea,
)

// Delete Area
router.delete("/:id", ...admin, validate(idParamsSchema, "params"), areaController.deleteArea)

export const areaRouter = router
