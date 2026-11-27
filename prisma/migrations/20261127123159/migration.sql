-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PAYMENT_PENDING', 'SUBMITTED', 'SHORTLISTED', 'HIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "job_posting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cv_url" TEXT NOT NULL,
    "cv_public_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_job_posting_id_status_idx" ON "applications"("job_posting_id", "status");

-- CreateIndex
CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_posting_id_user_id_key" ON "applications"("job_posting_id", "user_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
