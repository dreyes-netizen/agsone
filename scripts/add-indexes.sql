-- Performance indexes — run in Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_point_transaction_to_user ON "PointTransaction" ("toUserId");
CREATE INDEX IF NOT EXISTS idx_point_transaction_created_at ON "PointTransaction" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_point_transaction_to_user_created_at ON "PointTransaction" ("toUserId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_notification_user_created ON "Notification" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_notification_user_read ON "Notification" ("userId", "readAt");

CREATE INDEX IF NOT EXISTS idx_social_comment_post ON "SocialComment" ("postId");

CREATE INDEX IF NOT EXISTS idx_game_session_status_host ON "GameSession" ("status", "hostId");
CREATE INDEX IF NOT EXISTS idx_game_session_guest ON "GameSession" ("guestId");

CREATE INDEX IF NOT EXISTS idx_feedback_reply_feedback ON "FeedbackReply" ("feedbackId");

CREATE INDEX IF NOT EXISTS idx_milestone_award_user_type ON "MilestoneAward" ("userId", "type");

-- pg_trgm index for fast ILIKE search on document_chunks
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm ON document_chunks USING gin (content gin_trgm_ops);
