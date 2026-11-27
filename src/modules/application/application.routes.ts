import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { rateLimit } from "../../middlewares/rate-limit.js"
import { uploadCv } from "../../middlewares/upload-cv.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { applicationController } from "./application.controller.js"
import { applySchema, myApplicationsQuerySchema } from "./application.schema.js"

const router = Router()

// Get My Applications
router.get(
  "/me",
  authenticate,
  validate(myApplicationsQuerySchema, "query"),
  applicationController.getMyApplications,
)

export const applicationRouter = router

/*
Apply, mounted as POST /job-postings/:id/applications. Limited per user before the CV is read, so
a refused request costs no upload
*/
export const applyHandlers = [
  authenticate,
  rateLimit({ prefix: "apply", limit: 20, window: "1 h", key: (req) => requestUser(req).id }),
  validate(idParamsSchema, "params"),
  uploadCv,
  validate(applySchema, "body"),
  applicationController.apply,
]
