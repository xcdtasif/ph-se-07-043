/*
  Warnings:

  - A unique constraint covering the columns `[application_id]` on the table `employees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "reviewed_by_id" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "application_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_application_id_key" ON "employees"("application_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
