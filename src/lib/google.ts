import { OAuth2Client } from "google-auth-library"

import { env } from "../config/env.js"

const client = new OAuth2Client()

/*
Checks the ID token from the frontend's Google button: Google's signature, expiry, and that it was
issued to our client ID. Throws if any check fails
*/
export const verifyGoogleIdToken = async (idToken: string) => {
  const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID })

  return ticket.getPayload()
}
