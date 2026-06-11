INSERT INTO "ShoutoutRecipient" ("id", "postId", "userId")
SELECT gen_random_uuid()::text, "id", "recipientId"
FROM "SocialPost"
WHERE "recipientId" IS NOT NULL
ON CONFLICT ("postId", "userId") DO NOTHING;
