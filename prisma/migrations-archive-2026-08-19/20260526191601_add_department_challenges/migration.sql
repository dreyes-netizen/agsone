-- CreateEnum
CREATE TYPE "ChallengeMetric" AS ENUM ('TOTAL_POINTS', 'MISSIONS_COMPLETED', 'SHOUTOUTS_SENT');

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metric" "ChallengeMetric" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
