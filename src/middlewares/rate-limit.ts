import { Ratelimit } from "@upstash/ratelimit"
import type { Duration } from "@upstash/ratelimit"
import type { Request, RequestHandler } from "express"
import httpStatus from "http-status"

import { redis } from "../lib/redis.js"
import { AppError } from "../utils/app-error.js"

type RateLimitOptions = {
  prefix: string
  limit: number
  window: Duration
  key?: (req: Request) => string
}

const byIp = (req: Request) => req.ip ?? "unknown"

/*
Counters live in Redis because serverless instances share no memory. If Redis is down or slower
than `timeout`, requests pass: a missing rate limit is better than a missing API
*/
export const rateLimit = ({
  prefix,
  limit,
  window,
  key = byIp,
}: RateLimitOptions): RequestHandler => {
  const limiter = new Ratelimit({
    redis,
    prefix: `ratelimit:${prefix}`,
    limiter: Ratelimit.slidingWindow(limit, window),
    timeout: 1000,
  })

  return async (req, res, next) => {
    let result: Awaited<ReturnType<typeof limiter.limit>>

    try {
      result = await limiter.limit(key(req))
    } catch (err) {
      console.error("Rate limit check failed", err)
      next()

      return
    }

    res.setHeader("RateLimit-Limit", result.limit)
    res.setHeader("RateLimit-Remaining", result.remaining)

    if (!result.success) {
      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      res.setHeader("Retry-After", retryAfter)
      next(
        new AppError(
          httpStatus.TOO_MANY_REQUESTS,
          `Too many requests, try again in ${retryAfter} seconds`,
        ),
      )

      return
    }

    next()
  }
}
