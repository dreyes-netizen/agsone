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
