import type { AuthUser } from "../modules/auth/auth.user.js"

declare global {
  namespace Express {
    interface Request {
      // Set by authenticate
      user?: AuthUser
    }
  }
}
