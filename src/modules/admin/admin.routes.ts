import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { adminController } from "./admin.controller.js"
import { auditLogQuerySchema } from "./admin.schema.js"

const router = Router()

router.use(authenticate, authorize("ADMIN"))

// Get Stats
router.get("/stats", adminController.getStats)

// Get Audit Logs
router.get("/audit-logs", validate(auditLogQuerySchema, "query"), adminController.getAuditLogs)

export const adminRouter = router
