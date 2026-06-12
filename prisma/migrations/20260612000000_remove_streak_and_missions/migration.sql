-- Drop Mission and MissionCompletion tables
DROP TABLE IF EXISTS "MissionCompletion";
DROP TABLE IF EXISTS "Mission";

-- Drop Mission-related enum types
DROP TYPE IF EXISTS "MissionCompletionStatus";
DROP TYPE IF EXISTS "MissionType";

-- Remove streak columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "streakDays";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastActiveAt";

-- Remove ATTENDANCE and TASK from PointTransactionType enum
-- PostgreSQL does not support removing enum values directly.
-- These values are kept in the DB for historical transaction data integrity.
-- New code no longer creates ATTENDANCE or TASK transactions.

-- Remove MISSIONS_COMPLETED from ChallengeMetric enum
-- Create new enum without MISSIONS_COMPLETED, migrate data, then swap
ALTER TYPE "ChallengeMetric" RENAME TO "ChallengeMetric_old";
CREATE TYPE "ChallengeMetric" AS ENUM ('TOTAL_POINTS', 'SHOUTOUTS_SENT');
ALTER TABLE "Challenge" ALTER COLUMN "metric" TYPE "ChallengeMetric" USING (
  CASE "metric"::text
    WHEN 'MISSIONS_COMPLETED' THEN 'TOTAL_POINTS'
    ELSE "metric"::text
  END
)::"ChallengeMetric";
DROP TYPE "ChallengeMetric_old";
