-- CreateEnum
CREATE TYPE "OutageReportStatus" AS ENUM ('PENDING', 'LINKED', 'DISMISSED');

-- CreateTable
CREATE TABLE "outage_reports" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "description" TEXT,
    "status" "OutageReportStatus" NOT NULL DEFAULT 'PENDING',
    "dismiss_reason" TEXT,
    "dismissed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outage_reports_area_id_status_idx" ON "outage_reports"("area_id", "status");

-- CreateIndex
CREATE INDEX "outage_reports_customer_id_idx" ON "outage_reports"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "outage_reports_customer_id_area_id_pending_key" ON "outage_reports"("customer_id", "area_id") WHERE (status = 'PENDING');

-- AddForeignKey
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_dismissed_by_id_fkey" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
