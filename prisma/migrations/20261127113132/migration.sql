-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vacancies" INTEGER NOT NULL,
    "application_fee" INTEGER NOT NULL,
    "deadline" DATE NOT NULL,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_postings_zone_id_role_status_deadline_idx" ON "job_postings"("zone_id", "role", "status", "deadline");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
