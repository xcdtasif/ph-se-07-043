import path from "path"

import dotenv from "dotenv"
import { defineConfig, env } from "prisma/config"

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true })

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations need a direct connection; the app uses the pooled DATABASE_URL
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
})
