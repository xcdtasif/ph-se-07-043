import type { RequestHandler } from "express"
import httpStatus from "http-status"
import z from "zod"

import { env } from "../config/env.js"
import { AppError } from "../utils/app-error.js"
import { clientIp } from "../utils/client-ip.js"

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// Cloudflare's limit; longer strings can't be tokens
const MAX_TOKEN_LENGTH = 2048

const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).default([]),
})

// The secret is wrong or missing: our fault, not the user's
const CONFIG_ERRORS = ["missing-input-secret", "invalid-input-secret"]

/*
Checks the Cloudflare Turnstile token sent as `turnstileToken` in the body, then removes it so
the route's strict schema never sees it. Fails closed: if Cloudflare can't be reached, the
request is refused rather than let through unchecked
*/
export const verifyTurnstile: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.body?.turnstileToken

  if (typeof token !== "string" || token === "" || token.length > MAX_TOKEN_LENGTH) {
    throw new AppError(httpStatus.BAD_REQUEST, "Bot check required", [
      { path: "turnstileToken", message: "Complete the bot check and send its token" },
    ])
  }

  let result: z.output<typeof siteverifyResponseSchema>

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: clientIp(req),
      }),
      signal: AbortSignal.timeout(5000),
    })

    result = siteverifyResponseSchema.parse(await response.json())
  } catch (error) {
    console.error("Turnstile siteverify failed:", error)
    throw new AppError(httpStatus.BAD_GATEWAY, "Couldn't run the bot check, try again")
  }

  const errorCodes = result["error-codes"]

  if (!result.success) {
    if (errorCodes.some((code) => CONFIG_ERRORS.includes(code))) {
      console.error("Turnstile secret is misconfigured:", errorCodes)
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Internal server error")
    }

    if (errorCodes.includes("internal-error")) {
      throw new AppError(httpStatus.BAD_GATEWAY, "Couldn't run the bot check, try again")
    }

    // invalid-input-response, timeout-or-duplicate (tokens are single use, valid 5 minutes)
    throw new AppError(httpStatus.BAD_REQUEST, "Bot check failed, refresh it and try again")
  }

  delete req.body.turnstileToken

  next()
}
