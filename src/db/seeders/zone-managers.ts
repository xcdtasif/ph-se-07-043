import { seedUsers } from "../utils/seed-users.js"

const employee = (zoneCode: string) => ({ role: "ZONE_MANAGER" as const, zoneCode })

export const seedZoneManagers = () =>
  seedUsers(
    [
      { name: "Zone Manager 01", email: "zonemanager01@example.com", employee: employee("MIR") },
      { name: "Zone Manager 02", email: "zonemanager02@example.com", employee: employee("DHN") },
    ],
    "zone manager",
    "zone managers",
  )
