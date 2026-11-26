import path from "path"

import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true })

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

const validNodeEnv = ["development", "production"]
const nodeEnv = getEnv("NODE_ENV")

if (!validNodeEnv.includes(nodeEnv)) {
  throw new Error(`Invalid NODE_ENV: ${nodeEnv}`)
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: getEnvAsNumber("PORT"),
} as const
