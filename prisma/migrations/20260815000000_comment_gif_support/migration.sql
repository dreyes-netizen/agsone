-- Adds GIF-comment support to SocialComment. Additive and reversible: new
-- nullable columns + a new enum, content becomes optional (GIF-only comments
-- have no text). No existing rows are rewritten — every existing comment
-- keeps its content and defaults to commentType = 'TEXT'.
--
-- Only the SocialComment-related diff from `prisma migrate diff` was taken.
-- The live database also drifted from schema.prisma in unrelated ways (an
-- orphaned `document_chunks` table, and several indexes that were created
-- out-of-band under legacy `idx_*` names instead of Prisma's naming
-- convention) — those are pre-existing drift, not part of this change, and
-- are intentionally left untouched here.

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('TEXT', 'GIF');

-- AlterTable
ALTER TABLE "SocialComment" ADD COLUMN     "commentType" "CommentType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "gifId" TEXT,
ADD COLUMN     "gifProvider" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
