export type ErrorItem = {
  path: string
  message: string
}

export class AppError extends Error {
  statusCode: number
  errors: ErrorItem[]

  constructor(statusCode: number, message: string, errors: ErrorItem[] = []) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
    this.errors = errors
  }
}
