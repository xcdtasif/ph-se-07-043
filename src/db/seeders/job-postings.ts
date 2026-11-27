import type { EmployeeRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { dhakaDate } from "../../utils/dhaka-time.js"
import { logCount } from "../utils/log-count.js"

const DAY_MS = 24 * 60 * 60 * 1000

type SeedPosting = {
  // Also the seed's key: a posting with this title is seeded once
  title: string
  description: string
  zoneCode: string
  role: Exclude<EmployeeRole, "ADMIN">
  vacancies: number
  applicationFee: number
  postedDaysAgo: number
  // Dhaka days from today; negative has passed
  deadlineInDays: number
  status?: "CLOSED"
}

/*
Open, closed and past-deadline technician postings in Zone Manager 01's Mirpur, one in Dhanmondi,
and an admin's Zone Manager posting for Uttara, which has no Zone Manager
*/
const POSTINGS: SeedPosting[] = [
  {
    title: "Line Technician, Mirpur",
    description:
      "Restore supply on 11 kV and 0.4 kV lines across Mirpur: fault finding, fuse and breaker work, and storm repairs. Shift work, including nights.",
    zoneCode: "MIR",
    role: "TECHNICIAN",
    vacancies: 3,
    applicationFee: 500,
    postedDaysAgo: 3,
    deadlineInDays: 21,
  },
  {
    title: "Substation Technician, Mirpur",
    description:
      "Operate and maintain the Mirpur 33/11 kV substation: switching, transformer checks and protection relay tests. Two years of substation experience.",
    zoneCode: "MIR",
    role: "TECHNICIAN",
    vacancies: 1,
    applicationFee: 600,
    postedDaysAgo: 20,
    deadlineInDays: 10,
    status: "CLOSED",
  },
  {
    title: "Meter Technician, Mirpur",
    description:
      "Install, test and replace prepaid meters for Mirpur customers, and check connections reported as faulty.",
    zoneCode: "MIR",
    role: "TECHNICIAN",
    vacancies: 2,
    applicationFee: 300,
    postedDaysAgo: 40,
    deadlineInDays: -5,
  },
  {
    title: "Cable Jointer, Dhanmondi",
    description:
      "Joint and terminate underground cables in Dhanmondi after faults and roadwork damage. Experience with XLPE cable joints required.",
    zoneCode: "DHN",
    role: "TECHNICIAN",
    vacancies: 2,
    applicationFee: 400,
    postedDaysAgo: 5,
    deadlineInDays: 14,
  },
  {
    title: "Zone Manager, Uttara",
    description:
      "Run the Uttara zone: load shedding schedules, outage triage, technician hiring and the zone's reports. Five years in distribution operations.",
    zoneCode: "UTT",
    role: "ZONE_MANAGER",
    vacancies: 1,
    applicationFee: 1000,
    postedDaysAgo: 2,
    deadlineInDays: 30,
  },
]

// Technician postings come from the zone's Zone Manager, Zone Manager postings from an admin
const findPoster = (role: SeedPosting["role"], zoneId: string) =>
  prisma.employee.findFirst({
    where:
      role === "TECHNICIAN"
        ? { role: "ZONE_MANAGER", zoneId, endedAt: null }
        : { role: "ADMIN", endedAt: null },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  })

const seedPosting = async ({ zoneCode, postedDaysAgo, deadlineInDays, ...seed }: SeedPosting) => {
  const zone = await prisma.zone.findFirst({
    where: { code: zoneCode, deletedAt: null },
    select: { id: true },
  })
  const poster = zone && (await findPoster(seed.role, zone.id))

  if (!zone || !poster) return false

  const createdAt = new Date(Date.now() - postedDaysAgo * DAY_MS)

  await prisma.jobPosting.create({
    data: {
      ...seed,
      zoneId: zone.id,
      deadline: new Date(`${dhakaDate(deadlineInDays)}T00:00:00Z`),
      createdById: poster.userId,
      createdAt,
      updatedAt: createdAt,
    },
  })

  return true
}

// Safe to run again: a posting whose title is already there is skipped
export const seedJobPostings = async () => {
  const existing = await prisma.jobPosting.findMany({ select: { title: true } })
  const seeded = new Set(existing.map((posting) => posting.title))
  let count = 0

  for (const seed of POSTINGS) {
    if (!seeded.has(seed.title) && (await seedPosting(seed))) {
      count++
    }
  }

  logCount(count, "job posting", "job postings", "seeded")
}
