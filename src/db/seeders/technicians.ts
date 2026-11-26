import { seedUsers } from "../utils/seed-users.js"

const employee = (zoneCode: string) => ({ role: "TECHNICIAN" as const, zoneCode })

export const seedTechnicians = () =>
  seedUsers(
    [
      { name: "Technician 01", email: "technician01@example.com", employee: employee("MIR") },
      { name: "Technician 02", email: "technician02@example.com", employee: employee("MIR") },
      { name: "Technician 03", email: "technician03@example.com", employee: employee("MIR") },
      { name: "Technician 04", email: "technician04@example.com", employee: employee("DHN") },
      { name: "Technician 05", email: "technician05@example.com", employee: employee("DHN") },
    ],
    "technician",
    "technicians",
  )
