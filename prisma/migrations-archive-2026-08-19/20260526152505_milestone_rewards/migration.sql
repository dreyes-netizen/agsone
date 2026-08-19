-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('BIRTHDAY', 'WORK_ANNIVERSARY_1', 'WORK_ANNIVERSARY_3', 'WORK_ANNIVERSARY_5', 'WORK_ANNIVERSARY_10');

-- AlterEnum
ALTER TYPE "PointTransactionType" ADD VALUE 'MILESTONE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hireDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MilestoneConfig" (
    "id" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "pointsReward" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "MilestoneConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "year" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneConfig_type_key" ON "MilestoneConfig"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneAward_userId_type_year_key" ON "MilestoneAward"("userId", "type", "year");

-- AddForeignKey
ALTER TABLE "MilestoneConfig" ADD CONSTRAINT "MilestoneConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneAward" ADD CONSTRAINT "MilestoneAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
