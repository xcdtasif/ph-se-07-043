import { createHash, timingSafeEqual } from "crypto"
import { isIP } from "net"

import type { Request } from "express"

import { env } from "../config/env.js"

const digest = (value: string) => createHash("sha256").update(value).digest()

const FRONTEND_SECRET_DIGEST = digest(env.FRONTEND_SECRET)

/*
The visitor's IP address. The frontend calls this API from its server, so every visitor would
share the frontend's address; it sends the visitor's in X-Client-IP along with FRONTEND_SECRET,
which only the two apps know. Anyone else gets their own connection's address (req.ip)
*/
export const clientIp = (req: Request): string => {
  const secret = req.get("x-frontend-secret")
  const forwarded = req.get("x-client-ip")?.trim()

  // Digests have equal lengths, which timingSafeEqual needs
  if (
    secret &&
    forwarded &&
    isIP(forwarded) &&
    timingSafeEqual(digest(secret), FRONTEND_SECRET_DIGEST)
  ) {
    return forwarded
  }

  return req.ip ?? "unknown"
}
