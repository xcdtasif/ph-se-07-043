import { v2 as cloudinary } from "cloudinary"
import type { UploadApiResponse } from "cloudinary"

import { env } from "../config/env.js"

cloudinary.config({
  cloud_name: env.CLOUDINARY.cloudName,
  api_key: env.CLOUDINARY.apiKey,
  api_secret: env.CLOUDINARY.apiSecret,
  secure: true,
})

/*
Stored as an image-type asset, which Cloudinary serves as a .pdf link; the free plan only delivers
it once "Allow delivery of PDF and ZIP files" is on. The id is random, so the link can't be guessed,
unless publicId is given (the seed's sample CV), which replaces the file already there
*/
export const uploadPdf = (buffer: Buffer, folder: string, publicId?: string) =>
  new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
          format: "pdf",
          ...(publicId && { public_id: publicId, overwrite: true }),
        },
        (err?: unknown, result?: UploadApiResponse) => {
          if (err || !result) {
            reject(
              err instanceof Error ? err : new Error("Cloudinary upload failed", { cause: err }),
            )

            return
          }

          resolve({ url: result.secure_url, publicId: result.public_id })
        },
      )
      .end(buffer)
  })

export const deletePdf = async (publicId: string) => {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true })
}
