-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "load_shedding_slots" (
    "id" TEXT NOT NULL,
    "feeder_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'TENTATIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_shedding_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "load_shedding_slots_feeder_id_starts_at_idx" ON "load_shedding_slots"("feeder_id", "starts_at");

-- AddForeignKey
ALTER TABLE "load_shedding_slots" ADD CONSTRAINT "load_shedding_slots_feeder_id_fkey" FOREIGN KEY ("feeder_id") REFERENCES "feeders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_shedding_slots" ADD CONSTRAINT "load_shedding_slots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
