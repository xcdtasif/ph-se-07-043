import path from "path"

import dotenv from "dotenv"
import ms from "ms"
import type { StringValue } from "ms"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getEnvAsNumber(key: string): number {
  const value = Number(getEnv(key))
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${key} must be a valid number`)
  }
  return value
}

function getEnvAsDuration(key: string): StringValue {
  const value = getEnv(key) as StringValue
  const duration = ms(value)

  // ms returns undefined for unparsable input and accepts negatives like "-1d".
  // jsonwebtoken rounds down to whole seconds, so anything under 1s expires at once.
  if (!Number.isFinite(duration) || duration < 1000) {
    throw new Error(
      `Environment variable ${key} must be longer than 1 sec, like "15m", "7d" or "2 days"`,
    )
  }

  return value
}

/*
Cloudinary's single variable, cloudinary://<api_key>:<api_secret>@<cloud_name>, checked here so a
bad one stops the server at startup instead of failing the first upload
*/
function getEnvAsCloudinary(key: string) {
  const value = getEnv(key)
  let url: URL | undefined

  try {
    url = new URL(value)
  } catch {
    url = undefined
  }

  if (!url || url.protocol !== "cloudinary:" || !url.username || !url.password || !url.hostname) {
    throw new Error(
      `Environment variable ${key} must look like cloudinary://<api_key>:<api_secret>@<cloud_name>`,
    )
  }

  return {
    cloudName: url.hostname,
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
  }
}

const nodeEnv = getEnv("NODE_ENV")
const validNodeEnv = ["development", "production"]

if (!validNodeEnv.includes(nodeEnv)) {
  throw new Error(`Invalid NODE_ENV: ${nodeEnv}`)
}

export const env = {
  NODE_ENV: getEnv("NODE_ENV"),
  PORT: getEnvAsNumber("PORT"),
  CLIENT_URL: getEnv("CLIENT_URL"),
  FRONTEND_SECRET: getEnv("FRONTEND_SECRET"),

  DATABASE_URL: getEnv("DATABASE_URL"),
  DATABASE_URL_UNPOOLED: getEnv("DATABASE_URL_UNPOOLED"),

  UPSTASH_REDIS_REST_URL: getEnv("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: getEnv("UPSTASH_REDIS_REST_TOKEN"),

  BCRYPT_SALT_ROUNDS: getEnvAsNumber("BCRYPT_SALT_ROUNDS"),

  JWT_ACCESS_SECRET: getEnv("JWT_ACCESS_SECRET"),
  JWT_ACCESS_TOKEN_EXPIRES_IN: getEnvAsDuration("JWT_ACCESS_TOKEN_EXPIRES_IN"),
  JWT_REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET"),
  JWT_REFRESH_TOKEN_EXPIRES_IN: getEnvAsDuration("JWT_REFRESH_TOKEN_EXPIRES_IN"),

  SMTP_USER: getEnv("SMTP_USER"),
  SMTP_PASS: getEnv("SMTP_PASS"),

  TURNSTILE_SECRET_KEY: getEnv("TURNSTILE_SECRET_KEY"),

  GOOGLE_CLIENT_ID: getEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: getEnv("GOOGLE_CLIENT_SECRET"),

  CLOUDINARY: getEnvAsCloudinary("CLOUDINARY_URL"),
} as const
