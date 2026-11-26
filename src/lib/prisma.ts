import { PrismaNeon } from "@prisma/adapter-neon"

import { env } from "../config/env.js"
import { PrismaClient } from "../generated/prisma/client.js"

// Neon's WebSocket adapter supports interactive transactions
const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
