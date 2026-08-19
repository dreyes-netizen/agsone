
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BadgeCriteriaType" AS ENUM ('MANUAL', 'AUTO_RULE');

-- CreateEnum
CREATE TYPE "public"."CommentType" AS ENUM ('TEXT', 'GIF');

-- CreateEnum
CREATE TYPE "public"."FeedbackCategory" AS ENUM ('COMPENSATION_BENEFITS', 'WORK_LIFE_BALANCE', 'COMPANY_CULTURE', 'TEAM_DYNAMICS', 'PROCESSES_TOOLS', 'RECOGNITION', 'OTHER', 'HARASSMENT_DISCRIMINATION', 'ETHICAL_FRAUD', 'MISCONDUCT_ABUSE', 'SECURITY_POLICY');

-- CreateEnum
CREATE TYPE "public"."FeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."GameSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."GameType" AS ENUM ('SPIN_WHEEL', 'RAFFLE', 'MYSTERY_BOX', 'QUIZ', 'PREDICTION');

-- CreateEnum
CREATE TYPE "public"."MedicineCategory" AS ENUM ('PAIN_RELIEF', 'COUGH_COLD', 'ALLERGY', 'STOMACH', 'VITAMINS', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MedicineRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."PointTransactionType" AS ENUM ('MANUAL_AWARD', 'ATTENDANCE', 'TASK', 'KPI', 'CONTEST', 'REDEMPTION', 'GAME_WIN', 'GAME_SPEND', 'REFUND', 'MILESTONE', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('UPDATE', 'ACHIEVEMENT', 'CELEBRATION', 'ANNOUNCEMENT', 'POLL', 'SHOUTOUT');

-- CreateEnum
CREATE TYPE "public"."RedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "public"."RewardCategory" AS ENUM ('PHYSICAL', 'VOUCHER', 'PRIVILEGE', 'DIGITAL');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "public"."AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
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

-- CreateTable
CREATE TABLE "public"."Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "criteriaType" "public"."BadgeCriteriaType" NOT NULL DEFAULT 'MANUAL',
    "criteriaConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "category" "public"."FeedbackCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "public"."FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackReply" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoodListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrls" TEXT[],
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "addOns" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "FoodListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoodOrder" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedAddOns" JSONB NOT NULL DEFAULT '[]',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "FoodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Game" (
    "id" TEXT NOT NULL,
    "type" "public"."GameType" NOT NULL,
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
CREATE TABLE "public"."GamePlay" (
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
CREATE TABLE "public"."GameSession" (
    "id" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "guestId" TEXT,
    "status" "public"."GameSessionStatus" NOT NULL DEFAULT 'WAITING',
    "state" JSONB NOT NULL,
    "currentTurn" TEXT,
    "winnerId" TEXT,
    "pointsWager" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "version" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicineItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "public"."MedicineCategory" NOT NULL DEFAULT 'OTHER',

    CONSTRAINT "MedicineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicineRequest" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."MedicineRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MedicineRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupKey" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrgChartAdditionalReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgChartAdditionalReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PointOfContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointOfContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PointTransaction" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "public"."PointTransactionType" NOT NULL,
    "sourceReferenceId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "activity" TEXT,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PolicyDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,
    "content" TEXT,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollOption" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollVote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "public"."RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pointCost" INTEGER NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT -1,
    "category" "public"."RewardCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imageUrls" TEXT[],

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShoutoutRecipient" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ShoutoutRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "commentType" "public"."CommentType" NOT NULL DEFAULT 'TEXT',
    "gifId" TEXT,
    "gifProvider" TEXT,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "public"."PostType" NOT NULL DEFAULT 'UPDATE',
    "content" TEXT NOT NULL,
    "referenceId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "imageUrls" TEXT[],
    "flair" TEXT NOT NULL DEFAULT 'CASUAL',
    "title" TEXT,
    "departmentId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentId" TEXT,
    "managerId" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "birthday" TIMESTAMP(3),
    "hireDate" TIMESTAMP(3),
    "notificationPrefs" JSONB,
    "bio" TEXT,
    "skills" TEXT[],
    "bannerUrl" TEXT,
    "employeeId" TEXT,
    "orgChartDashed" BOOLEAN NOT NULL DEFAULT false,
    "orgChartHighlight" TEXT,
    "position" TEXT,
    "orgChartSortOrder" INTEGER NOT NULL DEFAULT 0,
    "orgChartPhotoPublicId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedById" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "public"."AuditLog"("action" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Badge_name_key" ON "public"."Badge"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "public"."Department"("name" ASC);

-- CreateIndex
CREATE INDEX "Feedback_authorId_updatedAt_idx" ON "public"."Feedback"("authorId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "Feedback_status_updatedAt_idx" ON "public"."Feedback"("status" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "idx_feedback_reply_feedback" ON "public"."FeedbackReply"("feedbackId" ASC);

-- CreateIndex
CREATE INDEX "FoodListing_isActive_idx" ON "public"."FoodListing"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_listingId_userId_key" ON "public"."FoodOrder"("listingId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "idx_game_session_guest" ON "public"."GameSession"("guestId" ASC);

-- CreateIndex
CREATE INDEX "idx_game_session_status_host" ON "public"."GameSession"("status" ASC, "hostId" ASC);

-- CreateIndex
CREATE INDEX "HrDocument_isActive_idx" ON "public"."HrDocument"("isActive" ASC);

-- CreateIndex
CREATE INDEX "MedicineItem_category_idx" ON "public"."MedicineItem"("category" ASC);

-- CreateIndex
CREATE INDEX "MedicineItem_isActive_idx" ON "public"."MedicineItem"("isActive" ASC);

-- CreateIndex
CREATE INDEX "MedicineRequest_status_idx" ON "public"."MedicineRequest"("status" ASC);

-- CreateIndex
CREATE INDEX "MedicineRequest_userId_idx" ON "public"."MedicineRequest"("userId" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_groupKey_readAt_idx" ON "public"."Notification"("userId" ASC, "groupKey" ASC, "readAt" ASC);

-- CreateIndex
CREATE INDEX "idx_notification_user_created" ON "public"."Notification"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_notification_user_read" ON "public"."Notification"("userId" ASC, "readAt" ASC);

-- CreateIndex
CREATE INDEX "OrgChartAdditionalReport_managerId_idx" ON "public"."OrgChartAdditionalReport"("managerId" ASC);

-- CreateIndex
CREATE INDEX "OrgChartAdditionalReport_userId_idx" ON "public"."OrgChartAdditionalReport"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OrgChartAdditionalReport_userId_managerId_key" ON "public"."OrgChartAdditionalReport"("userId" ASC, "managerId" ASC);

-- CreateIndex
CREATE INDEX "PointOfContact_sortOrder_idx" ON "public"."PointOfContact"("sortOrder" ASC);

-- CreateIndex
CREATE INDEX "PointTransaction_fromUserId_createdAt_idx" ON "public"."PointTransaction"("fromUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_point_transaction_created_at" ON "public"."PointTransaction"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_point_transaction_to_user" ON "public"."PointTransaction"("toUserId" ASC);

-- CreateIndex
CREATE INDEX "idx_point_transaction_to_user_created_at" ON "public"."PointTransaction"("toUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PolicyDocument_isActive_idx" ON "public"."PolicyDocument"("isActive" ASC);

-- CreateIndex
CREATE INDEX "PollOption_postId_idx" ON "public"."PollOption"("postId" ASC);

-- CreateIndex
CREATE INDEX "PollVote_createdAt_idx" ON "public"."PollVote"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_postId_userId_key" ON "public"."PollVote"("postId" ASC, "userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "public"."PushSubscription"("endpoint" ASC);

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "public"."PushSubscription"("userId" ASC);

-- CreateIndex
CREATE INDEX "Redemption_status_idx" ON "public"."Redemption"("status" ASC);

-- CreateIndex
CREATE INDEX "Redemption_userId_createdAt_idx" ON "public"."Redemption"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Reward_isActive_pointCost_idx" ON "public"."Reward"("isActive" ASC, "pointCost" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ShoutoutRecipient_postId_userId_key" ON "public"."ShoutoutRecipient"("postId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "SocialComment_createdAt_idx" ON "public"."SocialComment"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_social_comment_post" ON "public"."SocialComment"("postId" ASC);

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "public"."SocialPost"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "SocialPost_departmentId_idx" ON "public"."SocialPost"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "SocialPost_isPinned_createdAt_idx" ON "public"."SocialPost"("isPinned" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SocialReaction_createdAt_idx" ON "public"."SocialReaction"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SocialReaction_postId_userId_emoji_key" ON "public"."SocialReaction"("postId" ASC, "userId" ASC, "emoji" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "public"."User"("employeeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "public"."User"("firebaseUid" ASC);

-- CreateIndex
CREATE INDEX "User_managerId_orgChartSortOrder_idx" ON "public"."User"("managerId" ASC, "orgChartSortOrder" ASC);

-- CreateIndex
CREATE INDEX "User_pointsBalance_idx" ON "public"."User"("pointsBalance" ASC);

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "public"."User"("role" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "public"."UserBadge"("userId" ASC, "badgeId" ASC);

-- AddForeignKey
ALTER TABLE "public"."AppSetting" ADD CONSTRAINT "AppSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackReply" ADD CONSTRAINT "FeedbackReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackReply" ADD CONSTRAINT "FeedbackReply_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "public"."Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodListing" ADD CONSTRAINT "FoodListing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodOrder" ADD CONSTRAINT "FoodOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."FoodListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodOrder" ADD CONSTRAINT "FoodOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GamePlay" ADD CONSTRAINT "GamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GamePlay" ADD CONSTRAINT "GamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameSession" ADD CONSTRAINT "GameSession_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameSession" ADD CONSTRAINT "GameSession_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrDocument" ADD CONSTRAINT "HrDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicineItem" ADD CONSTRAINT "MedicineItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicineRequest" ADD CONSTRAINT "MedicineRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicineRequest" ADD CONSTRAINT "MedicineRequest_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "public"."MedicineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicineRequest" ADD CONSTRAINT "MedicineRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgChartAdditionalReport" ADD CONSTRAINT "OrgChartAdditionalReport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgChartAdditionalReport" ADD CONSTRAINT "OrgChartAdditionalReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointOfContact" ADD CONSTRAINT "PointOfContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointTransaction" ADD CONSTRAINT "PointTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointTransaction" ADD CONSTRAINT "PointTransaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointTransaction" ADD CONSTRAINT "PointTransaction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PolicyDocument" ADD CONSTRAINT "PolicyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollOption" ADD CONSTRAINT "PollOption_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "public"."PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Redemption" ADD CONSTRAINT "Redemption_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "public"."Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Redemption" ADD CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reward" ADD CONSTRAINT "Reward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShoutoutRecipient" ADD CONSTRAINT "ShoutoutRecipient_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShoutoutRecipient" ADD CONSTRAINT "ShoutoutRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialReaction" ADD CONSTRAINT "SocialReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialReaction" ADD CONSTRAINT "SocialReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

