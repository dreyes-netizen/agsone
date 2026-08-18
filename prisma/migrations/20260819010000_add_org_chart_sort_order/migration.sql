-- AlterTable
ALTER TABLE "User" ADD COLUMN     "orgChartSortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "User_managerId_orgChartSortOrder_idx" ON "User"("managerId", "orgChartSortOrder");
