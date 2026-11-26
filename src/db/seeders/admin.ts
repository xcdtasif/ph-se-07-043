import { prisma } from "../../lib/prisma.js"
import { authUtils } from "../../modules/auth/auth.utils.js"
import { logCount } from "../utils/log-count.js"

// Read here, not in config/env.ts: only the seed needs them, and they can differ per database
export const seedAdmin = async () => {
  const name = process.env["ADMIN_NAME"] || "Admin 01"
  const email = process.env["ADMIN_EMAIL"]?.trim().toLowerCase()
  const password = process.env["ADMIN_PASSWORD"]

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed Admin 01")
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { employees: { where: { endedAt: null }, select: { role: true } } },
  })

  if (existing) {
    if (existing.employees[0]?.role !== "ADMIN") {
      throw new Error(`A user with email ${email} exists but isn't an active admin`)
    }

    logCount(0, "admin", "admins", "seeded")
    return
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: await authUtils.hashPassword(password),
      employees: { create: { role: "ADMIN" } },
    },
  })

  logCount(1, "admin", "admins", "seeded")
}
