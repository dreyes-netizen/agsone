-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'HR_ADMIN');

-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('MANUAL_AWARD', 'ATTENDANCE', 'TASK', 'KPI', 'CONTEST', 'REDEMPTION', 'GAME_WIN', 'GAME_SPEND', 'REFUND');

-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('PHYSICAL', 'VOUCHER', 'PRIVILEGE', 'DIGITAL');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "BadgeCriteriaType" AS ENUM ('MANUAL', 'AUTO_RULE');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('SPIN_WHEEL', 'RAFFLE', 'MYSTERY_BOX', 'QUIZ', 'PREDICTION');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('UPDATE', 'ACHIEVEMENT', 'CELEBRATION', 'ANNOUNCEMENT', 'POLL');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentId" TEXT,
    "managerId" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "sourceReferenceId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pointCost" INTEGER NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT -1,
    "category" "RewardCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "criteriaType" "BadgeCriteriaType" NOT NULL DEFAULT 'MANUAL',
    "criteriaConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedById" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointsReward" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "type" "MissionType" NOT NULL DEFAULT 'INDIVIDUAL',
    "criteriaConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionCompletion" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,

    CONSTRAINT "MissionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "type" "GameType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "entryCostPoints" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dailyPlaysLimit" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlay" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "outcome" JSONB NOT NULL,
    "pointsWon" INTEGER NOT NULL DEFAULT 0,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "PostType" NOT NULL DEFAULT 'UPDATE',
    "content" TEXT NOT NULL,
    "referenceId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "Badge"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCompletion_missionId_userId_key" ON "MissionCompletion"("missionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialReaction_postId_userId_emoji_key" ON "SocialReaction"("postId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialReaction" ADD CONSTRAINT "SocialReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialReaction" ADD CONSTRAINT "SocialReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
