import type { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { logCount } from "../utils/log-count.js"

const HOUR_MS = 60 * 60 * 1000

type SeedReport = {
  email: string
  hoursAgo: number
  description?: string
  // Dismissed by the Zone Manager of the report's zone
  dismissReason?: string
}

/*
Pending reports for the Zone Managers to triage, and a dismissed one for Customer 01, who sees
both statuses. The outages seeder links the Dhanmondi one
*/
const REPORTS: SeedReport[] = [
  {
    email: "customer01@example.com",
    hoursAgo: 1,
    description: "No power since the evening, the whole lane is dark",
  },
  {
    email: "customer01@example.com",
    hoursAgo: 72,
    description: "Lights went out",
    dismissReason: "That was scheduled load shedding on MIR-F01",
  },
  { email: "customer02@example.com", hoursAgo: 2 },
  {
    email: "customer03@example.com",
    hoursAgo: 3,
    description: "Voltage dropped, then everything went off",
  },
  { email: "customer04@example.com", hoursAgo: 5, description: "Power cut after a loud bang" },
]

// Seeded once: running the seed again leaves existing reports alone
export const seedOutageReports = async () => {
  if ((await prisma.outageReport.count()) > 0) {
    logCount(0, "outage report", "outage reports", "seeded")

    return
  }

  const managers = await prisma.employee.findMany({
    where: { role: "ZONE_MANAGER", endedAt: null },
    select: { userId: true, zoneId: true },
  })
  const managerOfZone = new Map(managers.map((manager) => [manager.zoneId, manager.userId]))

  const data: Prisma.OutageReportCreateManyInput[] = []

  for (const { email, hoursAgo, description, dismissReason } of REPORTS) {
    const customer = await prisma.customer.findFirst({
      where: { user: { email } },
      select: {
        id: true,
        areaId: true,
        area: { select: { feeder: { select: { zoneId: true } } } },
      },
    })

    if (!customer) continue

    const createdAt = new Date(Date.now() - hoursAgo * HOUR_MS)
    const dismissedById = dismissReason && managerOfZone.get(customer.area.feeder.zoneId)

    data.push({
      customerId: customer.id,
      areaId: customer.areaId,
      description: description ?? null,
      createdAt,
      ...(dismissReason && dismissedById
        ? {
            status: "DISMISSED",
            dismissReason,
            dismissedById,
            updatedAt: new Date(createdAt.getTime() + HOUR_MS),
          }
        : { status: "PENDING" }),
    })
  }

  const { count } = await prisma.outageReport.createMany({ data })

  logCount(count, "outage report", "outage reports", "seeded")
}
