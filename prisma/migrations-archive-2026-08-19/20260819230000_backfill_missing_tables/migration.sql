-- Retroactive fix (2026-08-19): GameSession and ShoutoutRecipient were also
-- created entirely out-of-band via `db push` and never appeared in any
-- tracked migration at all — unlike the SocialPost.departmentId / MedicineItem
-- / MedicineRequest fixes folded into 20260730000000_add_missing_indexes,
-- nothing in this project's migration history ever references either table,
-- so there's no ordering dependency forcing this in-place; it's appended here
-- instead. Every statement is guarded/IF-NOT-EXISTS: a no-op against the real
-- target database (which already has both), and a normal create against an
-- empty one (Prisma Migrate's shadow database, or a fresh environment).
--
-- Index names for GameSession intentionally match the real database exactly
-- (idx_game_session_*, not Prisma's default naming) — these were created by
-- the same out-of-band scripts/add-indexes.sql mentioned in
-- 20260730000000_add_missing_indexes, and reproducing the real name here
-- (rather than Prisma's convention) keeps this reconstruction historically
-- accurate. Reconciling those names with schema.prisma's own naming
-- convention is a separate, pre-existing drift issue, not part of this fix.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GameSessionStatus') THEN
    CREATE TYPE "GameSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "GameSession" (
    "id" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "guestId" TEXT,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'WAITING',
    "state" JSONB NOT NULL,
    "currentTurn" TEXT,
    "winnerId" TEXT,
    "pointsWager" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShoutoutRecipient" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ShoutoutRecipient_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameSession_hostId_fkey') THEN
    ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey"
      FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameSession_guestId_fkey') THEN
    ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_guestId_fkey"
      FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameSession_winnerId_fkey') THEN
    ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_winnerId_fkey"
      FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShoutoutRecipient_postId_fkey') THEN
    ALTER TABLE "ShoutoutRecipient" ADD CONSTRAINT "ShoutoutRecipient_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShoutoutRecipient_userId_fkey') THEN
    ALTER TABLE "ShoutoutRecipient" ADD CONSTRAINT "ShoutoutRecipient_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_game_session_status_host" ON "GameSession"("status", "hostId");
CREATE INDEX IF NOT EXISTS "idx_game_session_guest" ON "GameSession"("guestId");

CREATE UNIQUE INDEX IF NOT EXISTS "ShoutoutRecipient_postId_userId_key" ON "ShoutoutRecipient"("postId", "userId");
