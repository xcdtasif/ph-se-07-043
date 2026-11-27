-- CreateEnum
CREATE TYPE "OutageCause" AS ENUM ('TRANSFORMER_FAULT', 'CABLE_DAMAGE', 'EMERGENCY_MAINTENANCE', 'TEMPORARY_TRIP', 'OTHER');

-- AlterTable
ALTER TABLE "outages" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "cause" "OutageCause",
ADD COLUMN     "restored_at" TIMESTAMP(3),
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "technician_id" TEXT;

-- CreateIndex
CREATE INDEX "outages_technician_id_status_idx" ON "outages"("technician_id", "status");

-- AddForeignKey
ALTER TABLE "outages" ADD CONSTRAINT "outages_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
