import type { EmployeeRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { authUtils } from "../../modules/auth/auth.utils.js"
import { logCount } from "./log-count.js"

// Every seed user except Admin 01 logs in with this; the frontend's demo buttons send it too
export const SEED_PASSWORD = "1a2s3d4f"

export type SeedUser = {
  name: string
  email: string
  isBanned?: boolean
  employee?: { role: EmployeeRole; zoneCode: string }
}

// Creates the users whose email isn't taken yet, with their employee row if they have one
export const seedUsers = async (users: SeedUser[], singular: string, plural: string) => {
  const existing = await prisma.user.findMany({
    where: { email: { in: users.map((user) => user.email) } },
    select: { email: true },
  })
  const existingEmails = new Set(existing.map((user) => user.email))
  const missing = users.filter((user) => !existingEmails.has(user.email))

  if (missing.length === 0) {
    logCount(0, singular, plural, "seeded")
    return
  }

  const zones = await prisma.zone.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  })
  const zoneIds = new Map(zones.map((zone) => [zone.code, zone.id]))
  const password = await authUtils.hashPassword(SEED_PASSWORD)

  for (const { employee, ...user } of missing) {
    let employees
    if (employee) {
      const zoneId = zoneIds.get(employee.zoneCode)
      if (!zoneId) {
        throw new Error(`Zone ${employee.zoneCode} not found; seed the grid first`)
      }
      employees = { create: { role: employee.role, zoneId } }
    }

    await prisma.user.create({ data: { ...user, password, ...(employees && { employees }) } })
  }

  logCount(missing.length, singular, plural, "seeded")
}
