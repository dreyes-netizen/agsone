-- CreateEnum
CREATE TYPE "MedicineCategory" AS ENUM ('PAIN_RELIEF', 'COUGH_COLD', 'ALLERGY', 'STOMACH', 'VITAMINS', 'OTHER');

-- AlterTable
ALTER TABLE "MedicineItem" ADD COLUMN "category" "MedicineCategory" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "MedicineItem_category_idx" ON "MedicineItem"("category");
