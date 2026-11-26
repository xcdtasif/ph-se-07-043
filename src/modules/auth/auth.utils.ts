import bcrypt from "bcryptjs"

import { env } from "../../config/env.js"
import { jwtUtils } from "../../utils/jwt.js"

// Compared against when the email has no password, so a missing account takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync("dummy-password", env.BCRYPT_SALT_ROUNDS)

const hashPassword = (password: string) => {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS)
}

const comparePassword = (password: string, hashedPassword: string) => {
  return bcrypt.compare(password, hashedPassword)
}

const generateTokens = (user: { id: string; tokenVersion: number }) => {
  const payload = { userId: user.id, tokenVersion: user.tokenVersion }

  const accessToken = jwtUtils.createToken(
    payload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_TOKEN_EXPIRES_IN,
  )
  const refreshToken = jwtUtils.createToken(
    payload,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_TOKEN_EXPIRES_IN,
  )

  return { accessToken, refreshToken }
}

const verifyAccessToken = (token: string) => {
  return jwtUtils.verifyToken(token, env.JWT_ACCESS_SECRET)
}

const verifyRefreshToken = (token: string) => {
  return jwtUtils.verifyToken(token, env.JWT_REFRESH_SECRET)
}

export const authUtils = {
  DUMMY_HASH,
  hashPassword,
  comparePassword,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
}
