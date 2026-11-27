import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { applicationController } from "../application/application.controller.js"
import { applyHandlers } from "../application/application.routes.js"
import { postingApplicationsQuerySchema } from "../application/application.schema.js"
import { jobPostingController } from "./job-posting.controller.js"
import {
  createJobPostingSchema,
  jobPostingListQuerySchema,
  updateJobPostingSchema,
} from "./job-posting.schema.js"

const router = Router()

// Zone Managers manage technician postings, admins Zone Manager postings; the service tells them apart
const poster = [authenticate, authorize("ZONE_MANAGER", "ADMIN")]

// Get Job Postings
router.get("/", validate(jobPostingListQuerySchema, "query"), jobPostingController.getJobPostings)

// Get Job Posting
router.get("/:id", validate(idParamsSchema, "params"), jobPostingController.getJobPosting)

// Create Job Posting
router.post(
  "/",
  ...poster,
  validate(createJobPostingSchema, "body"),
  jobPostingController.createJobPosting,
)

// Update Job Posting
router.patch(
  "/:id",
  ...poster,
  validate(idParamsSchema, "params"),
  validate(updateJobPostingSchema, "body"),
  jobPostingController.updateJobPosting,
)

// Delete Job Posting
router.delete(
  "/:id",
  ...poster,
  validate(idParamsSchema, "params"),
  jobPostingController.deleteJobPosting,
)

// Apply; any user who isn't an active employee
router.post("/:id/applications", ...applyHandlers)

// Get Job Posting Applications; paid ones, for the poster's role
router.get(
  "/:id/applications",
  ...poster,
  validate(idParamsSchema, "params"),
  validate(postingApplicationsQuerySchema, "query"),
  applicationController.getPostingApplications,
)

export const jobPostingRouter = router
