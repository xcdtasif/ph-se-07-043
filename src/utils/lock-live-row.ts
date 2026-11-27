import { Prisma } from "../generated/prisma/client.js"

type SoftDeleteTable = "zones" | "feeders" | "areas" | "job_postings"

/*
Locks a row that isn't soft deleted and says whether it exists. Deleting a parent takes UPDATE
and adding a child takes SHARE, so the two wait for each other: a delete can't miss a child
that's being added, and nothing is added under a parent that was just deleted
*/
export const lockLiveRow = async (
  tx: Prisma.TransactionClient,
  table: SoftDeleteTable,
  id: string,
  mode: "SHARE" | "UPDATE",
) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM ${Prisma.raw(table)}
    WHERE id = ${id} AND deleted_at IS NULL
    FOR ${Prisma.raw(mode)}`

  return rows.length > 0
}
