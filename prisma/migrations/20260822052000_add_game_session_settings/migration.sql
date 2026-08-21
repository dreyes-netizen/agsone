ALTER TABLE "GameSession"
ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}'::jsonb;
