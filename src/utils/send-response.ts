import type { Response } from "express"

type Meta = {
  page: number
  limit: number
  total: number
}

type ResData<T> = {
  statusCode: number
  message: string
  data?: T
  meta?: Meta
}

export const sendResponse = <T>(res: Response, { statusCode, message, data, meta }: ResData<T>) => {
  res.status(statusCode).json({ success: true, statusCode, message, data, meta })
}
