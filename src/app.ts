import express from "express"
import type { Application } from "express"
import httpStatus from "http-status"

import { errorHandler } from "./middlewares/error-handler.js"
import { notFound } from "./middlewares/not-found.js"
import { sendResponse } from "./utils/send-response.js"

const app: Application = express()

app.use(express.json())

app.get("/api/v1/health", (_req, res) => {
  sendResponse(res, { statusCode: httpStatus.OK, message: "Server is running" })
})

app.use(notFound)
app.use(errorHandler)

export default app
