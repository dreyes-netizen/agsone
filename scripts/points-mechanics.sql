-- Points mechanics: category/activity columns, DEDUCTION enum value, fromUserId index
ALTER TYPE "PointTransactionType" ADD VALUE IF NOT EXISTS 'DEDUCTION';
ALTER TABLE "PointTransaction" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "PointTransaction" ADD COLUMN IF NOT EXISTS "activity" TEXT;
CREATE INDEX IF NOT EXISTS "PointTransaction_fromUserId_createdAt_idx" ON "PointTransaction" ("fromUserId", "createdAt");
