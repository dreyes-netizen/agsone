-- AlterTable
ALTER TABLE "User" ADD COLUMN     "orgChartPhotoPublicId" TEXT;

-- CreateTable
CREATE TABLE "OrgChartAdditionalReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgChartAdditionalReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgChartAdditionalReport_userId_idx" ON "OrgChartAdditionalReport"("userId");

-- CreateIndex
CREATE INDEX "OrgChartAdditionalReport_managerId_idx" ON "OrgChartAdditionalReport"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgChartAdditionalReport_userId_managerId_key" ON "OrgChartAdditionalReport"("userId", "managerId");

-- AddForeignKey
ALTER TABLE "OrgChartAdditionalReport" ADD CONSTRAINT "OrgChartAdditionalReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgChartAdditionalReport" ADD CONSTRAINT "OrgChartAdditionalReport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
