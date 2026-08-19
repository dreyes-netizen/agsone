-- Notification grouping.
--
-- The bell renders the 30 most recent notifications with no pagination and no
-- aggregation, and nothing prunes the table. Adding high-volume social types
-- (reactions, comments) ungrouped would push every other notification out of a
-- user's window within minutes of one popular post.
--
-- `groupKey` collapses repeat events onto a single row and `count` records how
-- many collapsed into it. Only unread rows are ever merged into, so a repeat
-- after the user has looked produces a fresh notification rather than silently
-- mutating one they already dismissed.
--
-- Both columns are additive and nullable/defaulted, so existing rows are valid
-- as-is: every current notification is an ungrouped count-of-1.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "groupKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Notification_userId_groupKey_readAt_idx" ON "Notification"("userId", "groupKey", "readAt");
