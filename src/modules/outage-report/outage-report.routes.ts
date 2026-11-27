import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { outageReportController } from "./outage-report.controller.js"
import {
  createReportSchema,
  dismissReportSchema,
  myReportsQuerySchema,
  zoneReportsQuerySchema,
} from "./outage-report.schema.js"

const router = Router()

const customer = [authenticate, authorize("CUSTOMER")]
const zoneManager = [authenticate, authorize("ZONE_MANAGER")]

// Report Outage
router.post(
  "/",
  ...customer,
  validate(createReportSchema, "body"),
  outageReportController.createReport,
)

// Get My Reports
router.get(
  "/me",
  ...customer,
  validate(myReportsQuerySchema, "query"),
  outageReportController.getMyReports,
)

// Get Zone Reports
router.get(
  "/",
  ...zoneManager,
  validate(zoneReportsQuerySchema, "query"),
  outageReportController.getZoneReports,
)

// Dismiss Report
router.patch(
  "/:id/dismiss",
  ...zoneManager,
  validate(idParamsSchema, "params"),
  validate(dismissReportSchema, "body"),
  outageReportController.dismissReport,
)

export const outageReportRouter = router
