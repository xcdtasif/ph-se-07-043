import { Router } from "express"

import { authenticate } from "../../middlewares/authenticate.js"
import { authorize } from "../../middlewares/authorize.js"
import { validate } from "../../middlewares/validate.js"
import { idParamsSchema } from "../../utils/id-params.js"
import { employeeController } from "./employee.controller.js"
import { employeeListQuerySchema } from "./employee.schema.js"

const router = Router()

router.use(authenticate, authorize("ZONE_MANAGER", "ADMIN"))

// Get Employees
router.get("/", validate(employeeListQuerySchema, "query"), employeeController.getEmployees)

// End Employment
router.delete("/:id", validate(idParamsSchema, "params"), employeeController.endEmployment)

export const employeeRouter = router
