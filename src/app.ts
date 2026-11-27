import cors from "cors"
import express from "express"
import type { Application } from "express"
import helmet from "helmet"
import httpStatus from "http-status"

import { env } from "./config/env.js"
import { errorHandler } from "./middlewares/error-handler.js"
import { notFound } from "./middlewares/not-found.js"
import { rateLimit } from "./middlewares/rate-limit.js"
import { authRouter } from "./modules/auth/auth.routes.js"
import { customerRouter } from "./modules/customer/customer.routes.js"
import { adminUserRouter } from "./modules/user/user.admin.routes.js"
import { userRouter } from "./modules/user/user.routes.js"
import "./types/express.js"
import { sendResponse } from "./utils/send-response.js"

const app: Application = express()

// Vercel's proxy is one hop in front of the app, so req.ip is the client's address
app.set("trust proxy", 1)

app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL }))
app.use(rateLimit({ prefix: "global", limit: 100, window: "1 m" }))
app.use(express.json())

app.get("/api/v1/health", (_req, res) => {
  sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Server is running" })
})

// Auth
app.use("/api/v1/auth", authRouter)

// User
app.use("/api/v1/users", userRouter)

// Customer
app.use("/api/v1/customers", customerRouter)

// Admin
app.use("/api/v1/admin/users", adminUserRouter)

app.use(notFound)
app.use(errorHandler)

export default app
