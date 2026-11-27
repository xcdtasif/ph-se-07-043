-- CreateEnum
CREATE TYPE "OutageStatus" AS ENUM ('CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'RESTORED');

-- AlterTable
ALTER TABLE "outage_reports" ADD COLUMN     "outage_id" TEXT;

-- CreateTable
CREATE TABLE "outages" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "status" "OutageStatus" NOT NULL DEFAULT 'CONFIRMED',
    "note" TEXT,
    "confirmed_by_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outage_areas" (
    "outage_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,

    CONSTRAINT "outage_areas_pkey" PRIMARY KEY ("outage_id","area_id")
);

-- CreateIndex
CREATE INDEX "outages_zone_id_status_idx" ON "outages"("zone_id", "status");

-- CreateIndex
CREATE INDEX "outage_areas_area_id_idx" ON "outage_areas"("area_id");

-- CreateIndex
CREATE INDEX "outage_reports_outage_id_idx" ON "outage_reports"("outage_id");

-- AddForeignKey
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_outage_id_fkey" FOREIGN KEY ("outage_id") REFERENCES "outages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outages" ADD CONSTRAINT "outages_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outages" ADD CONSTRAINT "outages_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_areas" ADD CONSTRAINT "outage_areas_outage_id_fkey" FOREIGN KEY ("outage_id") REFERENCES "outages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_areas" ADD CONSTRAINT "outage_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
