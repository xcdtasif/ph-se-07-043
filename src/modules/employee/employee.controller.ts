import type { Request, Response } from "express"
import httpStatus from "http-status"

import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { EmployeeListQuery } from "./employee.schema.js"
import { employeeService } from "./employee.service.js"

const getEmployees = async (req: Request, res: Response) => {
  const { employees, meta } = await employeeService.getEmployees(
    requestUser(req),
    req.query as unknown as EmployeeListQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Employees fetched successfully",
    data: employees,
    meta,
  })
}

const endEmployment = async (req: Request<IdParams>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Employment ended successfully",
    data: await employeeService.endEmployment(requestUser(req), req.params.id),
  })
}

export const employeeController = { getEmployees, endEmployment }
