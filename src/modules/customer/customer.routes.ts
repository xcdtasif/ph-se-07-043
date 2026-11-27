import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { validate } from "../../middlewares/validate.js"
import { customerController } from "./customer.controller.js"
import { createCustomerSchema, updateCustomerSchema } from "./customer.schema.js"

const router = Router()

router.use(authenticate)

// Create My Customer Profile
router.post("/me", validate(createCustomerSchema, "body"), customerController.createMe)

// Update My Customer Profile
router.patch("/me", validate(updateCustomerSchema, "body"), customerController.updateMe)

export const customerRouter = router
