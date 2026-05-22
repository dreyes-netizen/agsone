-- CreateEnum
CREATE TYPE "MissionCompletionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MissionCompletion" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "status" "MissionCompletionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
