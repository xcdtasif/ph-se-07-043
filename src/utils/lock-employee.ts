import type { Prisma } from "../generated/prisma/client.js"

/*
Locks an employee row FOR UPDATE and says whether it exists. Assigning a technician and ending
an employment both take it, so a technician can't get two jobs at once, or a job while leaving
*/
export const lockEmployee = async (tx: Prisma.TransactionClient, id: string) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM employees WHERE id = ${id} FOR UPDATE`

  return rows.length > 0
}
