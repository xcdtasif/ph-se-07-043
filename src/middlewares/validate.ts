import type { Request, Response, NextFunction } from "express"
import httpStatus from "http-status"
import type z from "zod"

import { AppError } from "../utils/app-error.js"

type Source = "body" | "query" | "params"

export const validate =
  (schema: z.ZodType, source: Source) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync(req[source] ?? {})

    if (!result.success) {
      // The assignment's error shape: one { path, message } per problem
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join(".") || source,
        message: issue.message,
      }))

      next(new AppError(httpStatus.BAD_REQUEST, `Validation of ${source} failed`, errors))

      return
    }

    if (source === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
      })
    } else {
      req[source] = result.data
    }

    next()
  }
