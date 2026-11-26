import { prisma } from "../../lib/prisma.js"
import { logCount } from "../utils/log-count.js"

// Uttara has no Zone Manager in the seed, so an Admin job posting can fill it
const ZONES = [
  {
    name: "Mirpur",
    code: "MIR",
    feeders: [
      {
        name: "Mirpur 10",
        code: "MIR-F01",
        areas: ["Mirpur 10, Block A", "Mirpur 10, Block C", "Mirpur 11, Block B"],
      },
      {
        name: "Pallabi",
        code: "MIR-F02",
        areas: ["Pallabi, Section 6", "Pallabi, Section 7", "Mirpur 12, Block D"],
      },
    ],
  },
  {
    name: "Dhanmondi",
    code: "DHN",
    feeders: [
      {
        name: "Dhanmondi West",
        code: "DHN-F01",
        areas: ["Dhanmondi Road 27", "Dhanmondi Road 32"],
      },
      { name: "Jigatola", code: "DHN-F02", areas: ["Jigatola", "Hazaribagh"] },
    ],
  },
  {
    name: "Uttara",
    code: "UTT",
    feeders: [
      { name: "Uttara North", code: "UTT-F01", areas: ["Uttara Sector 10", "Uttara Sector 11"] },
      { name: "Uttara South", code: "UTT-F02", areas: ["Uttara Sector 3", "Uttara Sector 4"] },
    ],
  },
]

export const seedGrid = async () => {
  const existing = await prisma.zone.findMany({
    where: { code: { in: ZONES.map((zone) => zone.code) }, deletedAt: null },
    select: { code: true },
  })
  const existingCodes = new Set(existing.map((zone) => zone.code))
  const missing = ZONES.filter((zone) => !existingCodes.has(zone.code))

  for (const zone of missing) {
    await prisma.zone.create({
      data: {
        name: zone.name,
        code: zone.code,
        feeders: {
          create: zone.feeders.map((feeder) => ({
            name: feeder.name,
            code: feeder.code,
            areas: { create: feeder.areas.map((name) => ({ name })) },
          })),
        },
      },
    })
  }

  logCount(missing.length, "zone", "zones", "seeded")
}
