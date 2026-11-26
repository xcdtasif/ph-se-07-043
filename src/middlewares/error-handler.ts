import type { ErrorRequestHandler } from "express"
import httpStatus from "http-status"

import { AppError } from "../utils/app-error.js"
import type { ErrorItem } from "../utils/app-error.js"
import { handlePrismaError } from "../utils/handle-prisma-error.js"
import { sendResponse } from "../utils/send-response.js"

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

/*
An error event (e.g. the database WebSocket's) keeps its cause in `error` and `message`,
which console.error doesn't print, so name them
*/
const describeEvent = (event: Event) => {
  const { error, message } = event as Event & { error?: unknown; message?: string }

  return { event: event.type, message, error }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)

    return
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR
  let message = "Internal server error"
  let errors: ErrorItem[] = []

  const prismaError = handlePrismaError(err)

  if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    errors = err.errors
  } else if (prismaError) {
    statusCode = prismaError.statusCode
    message = prismaError.message
    errors = prismaError.errors ?? []
  } else if (isExposedHttpError(err)) {
    statusCode = err.status
    message = err.message
  }

  if (statusCode >= httpStatus.INTERNAL_SERVER_ERROR) {
    console.error(err instanceof Event ? describeEvent(err) : err)
  }

  sendResponse(res, { success: false, statusCode, message, errors })
}
