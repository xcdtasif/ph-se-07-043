import httpStatus from "http-status"

import type { Prisma } from "../../generated/prisma/client.js"
import { writeAuditLog } from "../../lib/audit.js"
import { prisma } from "../../lib/prisma.js"
import { AppError } from "../../utils/app-error.js"
import { lockEmployee } from "../../utils/lock-employee.js"
import { managedZoneId } from "../../utils/managed-zone.js"
import type { AuthUser } from "../auth/auth.user.js"
import { activeJob } from "../outage/outage.service.js"
import type { EmployeeListQuery } from "./employee.schema.js"

// activeJob shows a Zone Manager who is free to assign and what each technician is on
const employeeSelect = {
  id: true,
  role: true,
  createdAt: true,
  endedAt: true,
  zone: { select: { id: true, name: true, code: true } },
  user: { select: { id: true, name: true, email: true } },
  assignedOutages: { where: activeJob, select: { id: true, status: true }, take: 1 },
} as const

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>

const toEmployee = ({ assignedOutages, ...employee }: EmployeeRow) => ({
  ...employee,
  activeJob: assignedOutages[0] ?? null,
})

// What the actor may see: an admin everyone, a Zone Manager their zone's technicians
const scope = (user: AuthUser): Prisma.EmployeeWhereInput =>
  user.employee?.role === "ADMIN" ? {} : { role: "TECHNICIAN", zoneId: managedZoneId(user) }

// Active employees, by name
const getEmployees = async (user: AuthUser, query: EmployeeListQuery) => {
  const { page, limit, role, zoneId, search } = query

  const where: Prisma.EmployeeWhereInput = {
    AND: [
      { endedAt: null },
      {
        ...(role && { role }),
        ...(zoneId && { zoneId }),
        ...(search && {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        }),
      },
      scope(user),
    ],
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ])

  return { employees: employees.map(toEmployee), meta: { page, limit, total } }
}

/*
Ends an employment; the row stays as history. The row is locked, so a job can't be assigned
while the technician leaves, and a technician with an active job must hand it over first
*/
const endEmployment = async (user: AuthUser, id: string) => {
  const isAdmin = user.employee?.role === "ADMIN"

  return prisma.$transaction(async (tx) => {
    const employee = (await lockEmployee(tx, id))
      ? await tx.employee.findUnique({
          where: { id },
          select: { role: true, zoneId: true, endedAt: true },
        })
      : null

    if (!employee) {
      throw new AppError(httpStatus.NOT_FOUND, "Employee not found")
    }

    if (isAdmin && employee.role === "ADMIN") {
      throw new AppError(httpStatus.FORBIDDEN, "An admin's employment can't be ended")
    }

    if (!isAdmin && (employee.role !== "TECHNICIAN" || employee.zoneId !== managedZoneId(user))) {
      throw new AppError(httpStatus.FORBIDDEN, "This employee isn't one of your zone's technicians")
    }

    if (employee.endedAt) {
      throw new AppError(httpStatus.CONFLICT, "This employment has already ended")
    }

    const job = await tx.outage.findFirst({
      where: { technicianId: id, ...activeJob },
      select: { id: true },
    })

    if (job) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This technician has an active job; reassign it or finish it first",
      )
    }

    const ended = await tx.employee.update({
      where: { id },
      data: { endedAt: new Date() },
      select: employeeSelect,
    })

    await writeAuditLog(tx, {
      actorId: user.id,
      action: "EMPLOYMENT_ENDED",
      entityType: "EMPLOYEE",
      entityId: id,
      before: { endedAt: null },
      after: { endedAt: ended.endedAt?.toISOString() ?? null },
    })

    return toEmployee(ended)
  })
}

export const employeeService = { getEmployees, endEmployment }
