-- RenameIndex
ALTER INDEX "idx_feedback_reply_feedback" RENAME TO "FeedbackReply_feedbackId_idx";

-- RenameIndex
ALTER INDEX "idx_game_session_guest" RENAME TO "GameSession_guestId_idx";

-- RenameIndex
ALTER INDEX "idx_game_session_status_host" RENAME TO "GameSession_status_hostId_idx";

-- RenameIndex
ALTER INDEX "idx_notification_user_created" RENAME TO "Notification_userId_createdAt_idx";

-- RenameIndex
ALTER INDEX "idx_notification_user_read" RENAME TO "Notification_userId_readAt_idx";

-- RenameIndex
ALTER INDEX "idx_point_transaction_created_at" RENAME TO "PointTransaction_createdAt_idx";

-- RenameIndex
ALTER INDEX "idx_point_transaction_to_user" RENAME TO "PointTransaction_toUserId_idx";

-- RenameIndex
ALTER INDEX "idx_point_transaction_to_user_created_at" RENAME TO "PointTransaction_toUserId_createdAt_idx";

-- RenameIndex
ALTER INDEX "idx_social_comment_post" RENAME TO "SocialComment_postId_idx";
