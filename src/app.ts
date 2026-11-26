import cors from "cors"
import express from "express"
import type { Application } from "express"
import helmet from "helmet"
import httpStatus from "http-status"

import { env } from "./config/env.js"
import { errorHandler } from "./middlewares/error-handler.js"
import { notFound } from "./middlewares/not-found.js"
import { rateLimit } from "./middlewares/rate-limit.js"
import { sendResponse } from "./utils/send-response.js"

const app: Application = express()

// Vercel's proxy is one hop in front of the app, so req.ip is the client's address
app.set("trust proxy", 1)

app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL }))
app.use(rateLimit({ prefix: "global", limit: 100, window: "1 m" }))
app.use(express.json())

app.get("/api/v1/health", (_req, res) => {
  sendResponse(res, { statusCode: httpStatus.OK, message: "Server is running" })
})

app.use(notFound)
app.use(errorHandler)

export default app
