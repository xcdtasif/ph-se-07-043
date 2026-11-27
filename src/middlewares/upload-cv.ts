import type { RequestHandler } from "express"
import httpStatus from "http-status"
import multer from "multer"

import { AppError } from "../utils/app-error.js"

const CV_FIELD = "cv"
const CV_MAX_MB = 2

// Kept in memory: Vercel's disk is read-only, and the file goes straight on to Cloudinary
const parseCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_MAX_MB * 1024 * 1024, files: 1, fields: 10 },
}).single(CV_FIELD)

const cvError = (message: string, path = CV_FIELD) =>
  new AppError(httpStatus.BAD_REQUEST, "Validation of body failed", [{ path, message }])

const multerMessage = (err: multer.MulterError) => {
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return `CV must be ${CV_MAX_MB} MB or smaller`
    case "LIMIT_FILE_COUNT":
    case "LIMIT_UNEXPECTED_FILE":
      return `Send one file, in the ${CV_FIELD} field`
    default:
      return err.message
  }
}

/*
Reads a multipart form with one PDF in the cv field. The browser's type is only a claim, so the
file must also start with %PDF-
*/
export const uploadCv: RequestHandler = (req, res, next) => {
  parseCv(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(cvError(multerMessage(err), err.field === CV_FIELD || !err.field ? CV_FIELD : err.field))

      return
    }

    // Anything else comes from reading the form itself, e.g. a cut-off upload
    if (err) {
      next(new AppError(httpStatus.BAD_REQUEST, "Send the form as multipart/form-data"))

      return
    }

    const file = req.file

    if (!file) {
      next(cvError("Attach your CV as a PDF"))

      return
    }

    if (
      file.mimetype !== "application/pdf" ||
      file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-"
    ) {
      next(cvError("CV must be a PDF"))

      return
    }

    next()
  })
}
