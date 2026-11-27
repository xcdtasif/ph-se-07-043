import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { applyHandlers } from "../application/application.routes.js"
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

export const jobPostingRouter = router
