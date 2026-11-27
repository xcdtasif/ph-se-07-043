import { env } from "../config/env.js"
import { prisma } from "../lib/prisma.js"
import { logCount } from "./utils/log-count.js"

const deleteAll = async () => {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to delete data when NODE_ENV is production")
  }

  /*
  Order follows the foreign keys: children are deleted before their parents.
  Not run in a transaction: deleting is safe to repeat if it fails halfway.
  */
  const auditLogs = await prisma.auditLog.deleteMany()
  logCount(auditLogs.count, "audit log", "audit logs", "deleted")

  const reports = await prisma.outageReport.deleteMany()
  logCount(reports.count, "outage report", "outage reports", "deleted")

  const outageAreas = await prisma.outageArea.deleteMany()
  logCount(outageAreas.count, "outage area", "outage areas", "deleted")

  const outages = await prisma.outage.deleteMany()
  logCount(outages.count, "outage", "outages", "deleted")

  const slots = await prisma.loadSheddingSlot.deleteMany()
  logCount(slots.count, "load shedding slot", "load shedding slots", "deleted")

  const postings = await prisma.jobPosting.deleteMany()
  logCount(postings.count, "job posting", "job postings", "deleted")

  const customers = await prisma.customer.deleteMany()
  logCount(customers.count, "customer", "customers", "deleted")

  const employees = await prisma.employee.deleteMany()
  logCount(employees.count, "employee", "employees", "deleted")

  const users = await prisma.user.deleteMany()
  logCount(users.count, "user", "users", "deleted")

  const areas = await prisma.area.deleteMany()
  logCount(areas.count, "area", "areas", "deleted")

  const feeders = await prisma.feeder.deleteMany()
  logCount(feeders.count, "feeder", "feeders", "deleted")

  const zones = await prisma.zone.deleteMany()
  logCount(zones.count, "zone", "zones", "deleted")
}

try {
  await deleteAll()
} catch (error) {
  console.error("Deleting data failed:", error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
