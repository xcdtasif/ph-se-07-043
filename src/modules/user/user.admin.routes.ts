import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { adminUserController } from "./user.admin.controller.js"
import { banUserSchema, userIdParamsSchema, userListQuerySchema } from "./user.admin.schema.js"

const router = Router()

router.use(authenticate, authorize("ADMIN"))

// Get All Users
router.get("/", validate(userListQuerySchema, "query"), adminUserController.getAllUsers)

// Ban Or Unban User
router.patch(
  "/:id/ban",
  validate(userIdParamsSchema, "params"),
  validate(banUserSchema, "body"),
  adminUserController.banUser,
)

export const adminUserRouter = router
