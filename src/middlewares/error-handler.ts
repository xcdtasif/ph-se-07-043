import type { ErrorRequestHandler } from "express"
import httpStatus from "http-status"

import { AppError } from "../utils/app-error.js"
import type { ErrorItem } from "../utils/app-error.js"

/*
Express's body parser throws http-errors (malformed JSON, body too large) with a 4xx `status`
and `expose: true`, meaning the message is safe to show the client
*/
const isExposedHttpError = (err: unknown): err is { status: number; message: string } =>
  typeof err === "object" &&
  err !== null &&
  "expose" in err &&
  err.expose === true &&
  "status" in err &&
  typeof err.status === "number"

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)

    return
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR
  let message = "Internal server error"
  let errors: ErrorItem[] = []

  if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    errors = err.errors
  } else if (isExposedHttpError(err)) {
    statusCode = err.status
    message = err.message
  }

  if (statusCode >= httpStatus.INTERNAL_SERVER_ERROR) {
    console.error(err)
  }

  res.status(statusCode).json({ success: false, statusCode, message, errors })
}
