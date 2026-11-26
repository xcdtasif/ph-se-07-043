import { prisma } from "../lib/prisma.js"
import { seedAdmin } from "./seeders/admin.js"
import { seedCustomers } from "./seeders/customers.js"
import { seedGrid } from "./seeders/grid.js"
import { seedTechnicians } from "./seeders/technicians.js"
import { seedZoneManagers } from "./seeders/zone-managers.js"

// Safe to run again: each seeder only adds what's missing.
// Runs in production too, since the live API needs the demo accounts.
try {
  await seedGrid()
  await seedAdmin()
  await seedZoneManagers()
  await seedTechnicians()
  await seedCustomers()
} catch (error) {
  console.error("Seeding failed:", error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
