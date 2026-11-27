import type { Request, Response } from "express"
import httpStatus from "http-status"

import { AppError } from "../../utils/app-error.js"
import type { IdParams } from "../../utils/id-params.js"
import { requestUser } from "../../utils/request-user.js"
import { sendResponse } from "../../utils/send-response.js"
import type { AdminPaymentsQuery, MyPaymentsQuery } from "./payment.schema.js"
import { paymentService } from "./payment.service.js"

const createCheckout = async (req: Request<IdParams>, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Checkout ready; open checkoutUrl to pay",
    data: await paymentService.createCheckout(requestUser(req), req.params.id),
  })
}

const handleWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"]

  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid webhook request")
  }

  await paymentService.handleWebhook(req.body, signature)

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Webhook processed successfully",
  })
}

const getMyPayments = async (req: Request, res: Response) => {
  const { payments, meta } = await paymentService.getMyPayments(
    requestUser(req),
    req.query as unknown as MyPaymentsQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Payments fetched successfully",
    data: payments,
    meta,
  })
}

const getAllPayments = async (req: Request, res: Response) => {
  const { payments, meta } = await paymentService.getAllPayments(
    req.query as unknown as AdminPaymentsQuery,
  )

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Payments fetched successfully",
    data: payments,
    meta,
  })
}

// The PDF itself, not the JSON envelope; attachment makes browsers save it under its number
const getInvoice = async (req: Request<IdParams>, res: Response) => {
  const { filename, pdf } = await paymentService.getInvoice(requestUser(req), req.params.id)

  res
    .status(httpStatus.OK)
    .set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    })
    .send(pdf)
}

export const paymentController = {
  createCheckout,
  handleWebhook,
  getMyPayments,
  getAllPayments,
  getInvoice,
}
