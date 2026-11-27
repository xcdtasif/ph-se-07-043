import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { analyticsController } from "./analytics.controller.js"
import { outageAnalyticsQuerySchema } from "./analytics.schema.js"

const router = Router()

// Get Outage Analytics; a Zone Manager their own zone, an admin any zone or all of them
router.get(
  "/outages",
  authenticate,
  authorize("ZONE_MANAGER", "ADMIN"),
  validate(outageAnalyticsQuerySchema, "query"),
  analyticsController.getOutageAnalytics,
)

export const analyticsRouter = router
