import { OAuth2Client } from "google-auth-library"

import { env } from "../config/env.js"

// "postmessage" is the redirect URI for codes from a popup, which hands the code to the page
const client = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: "postmessage",
})

/*
Trades the one-time code from the frontend's Google popup for the user's ID token, then checks it:
Google's signature, expiry, and that it was issued to our client ID. Throws if the code is invalid,
used or expired, or if any check fails
*/
export const getGoogleProfile = async (code: string) => {
  const { tokens } = await client.getToken(code)

  if (!tokens.id_token) {
    throw new Error("Google returned no ID token")
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  })

  return ticket.getPayload()
}
