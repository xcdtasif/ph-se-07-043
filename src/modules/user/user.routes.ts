import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { userController } from "./user.controller.js"

const router = Router()

router.use(authenticate)

// Get Me
router.get("/me", userController.getMe)

export const userRouter = router
