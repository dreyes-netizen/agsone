-- Performance audit (2026-07-30): reconcile schema.prisma @@index
-- declarations against the live database.
--
-- No migration in this project's history has ever contained a CREATE INDEX
-- statement — every non-unique index that exists in production today was
-- applied out-of-band via scripts/add-indexes.sql, which covered only 11 of
-- the indexes schema.prisma declares. This migration is split into two
-- groups:
--
--   1. Indexes schema.prisma already declared but that were never actually
--      created in the database (confirmed via a live pg_indexes query).
--   2. New indexes added by this same audit for query patterns that had no
--      matching @@index at all (AuditLog, Feedback, FoodListing,
--      MedicineItem, PolicyDocument, PollOption).
--
-- All statements use IF NOT EXISTS: safe to run against a database where
-- some of these may already exist from a manual `db push`, and safe to
-- re-run.
--
-- Table sizes at the time of writing are tiny (User: 156 rows, SocialPost: 1
-- row, etc.) — these indexes are not fixing a current slow query, they're
-- closing the gap between schema.prisma and the database before either
-- grows enough for the gap to matter.
--
-- Retroactive fix (2026-08-19): SocialPost.departmentId itself — not just its
-- index below — was also only ever added out-of-band via `db push`, never by
-- a tracked migration. That's harmless against the real target database
-- (which already has the column and its FK; both statements below are
-- no-ops there), but it broke a from-scratch replay of this history (e.g.
-- Prisma Migrate's shadow database, or a brand new environment): the
-- CREATE INDEX on SocialPost("departmentId") a few lines down would run
-- against a table that doesn't have that column yet. Fixing it in place
-- (rather than as a new migration appended at the end) is required here
-- specifically because the dependency is on ORDER: a later migration can't
-- retroactively make an earlier one's CREATE INDEX succeed.
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SocialPost_departmentId_fkey') THEN
    ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Retroactive fix (2026-08-19): the medicine board's tables themselves —
-- MedicineItem and MedicineRequest, not just the indexes below — were also
-- only ever created out-of-band via `db push`. No-op against the real
-- target database (already has both tables); required for a from-scratch
-- replay to reach the CREATE INDEX statements on them below. Deliberately
-- excludes MedicineItem.category — that column and its own index are added
-- later by 20260815000001_add_medicine_category, and must stay there so
-- this reconstruction matches this exact point in history.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MedicineRequestStatus') THEN
    CREATE TYPE "MedicineRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MedicineItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedicineRequest" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "MedicineRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicineItem_createdById_fkey') THEN
    ALTER TABLE "MedicineItem" ADD CONSTRAINT "MedicineItem_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicineRequest_medicineId_fkey') THEN
    ALTER TABLE "MedicineRequest" ADD CONSTRAINT "MedicineRequest_medicineId_fkey"
      FOREIGN KEY ("medicineId") REFERENCES "MedicineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicineRequest_userId_fkey') THEN
    ALTER TABLE "MedicineRequest" ADD CONSTRAINT "MedicineRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicineRequest_approvedById_fkey') THEN
    ALTER TABLE "MedicineRequest" ADD CONSTRAINT "MedicineRequest_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Group 1: declared in schema.prisma, missing from the live database ─────

CREATE INDEX IF NOT EXISTS "User_pointsBalance_idx" ON "User"("pointsBalance");
CREATE INDEX IF NOT EXISTS "User_role_isActive_idx" ON "User"("role", "isActive");

CREATE INDEX IF NOT EXISTS "Reward_isActive_pointCost_idx" ON "Reward"("isActive", "pointCost");

CREATE INDEX IF NOT EXISTS "Redemption_status_idx" ON "Redemption"("status");
CREATE INDEX IF NOT EXISTS "Redemption_userId_createdAt_idx" ON "Redemption"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "SocialPost_isPinned_createdAt_idx" ON "SocialPost"("isPinned", "createdAt");
CREATE INDEX IF NOT EXISTS "SocialPost_departmentId_idx" ON "SocialPost"("departmentId");
CREATE INDEX IF NOT EXISTS "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");

CREATE INDEX IF NOT EXISTS "SocialReaction_createdAt_idx" ON "SocialReaction"("createdAt");

CREATE INDEX IF NOT EXISTS "SocialComment_createdAt_idx" ON "SocialComment"("createdAt");

CREATE INDEX IF NOT EXISTS "PollVote_createdAt_idx" ON "PollVote"("createdAt");

CREATE INDEX IF NOT EXISTS "MedicineRequest_status_idx" ON "MedicineRequest"("status");
CREATE INDEX IF NOT EXISTS "MedicineRequest_userId_idx" ON "MedicineRequest"("userId");

-- ── Group 2: newly added @@index declarations (no prior index existed) ─────

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "Feedback_authorId_updatedAt_idx" ON "Feedback"("authorId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Feedback_status_updatedAt_idx" ON "Feedback"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "FoodListing_isActive_idx" ON "FoodListing"("isActive");

CREATE INDEX IF NOT EXISTS "MedicineItem_isActive_idx" ON "MedicineItem"("isActive");

CREATE INDEX IF NOT EXISTS "PolicyDocument_isActive_idx" ON "PolicyDocument"("isActive");

CREATE INDEX IF NOT EXISTS "PollOption_postId_idx" ON "PollOption"("postId");
