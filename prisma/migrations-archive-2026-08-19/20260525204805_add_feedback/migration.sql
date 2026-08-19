-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('COMPENSATION_BENEFITS', 'WORK_LIFE_BALANCE', 'COMPANY_CULTURE', 'TEAM_DYNAMICS', 'PROCESSES_TOOLS', 'RECOGNITION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "category" "FeedbackCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReply" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackReply_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReply" ADD CONSTRAINT "FeedbackReply_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReply" ADD CONSTRAINT "FeedbackReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
