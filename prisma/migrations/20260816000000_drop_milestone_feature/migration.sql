-- Drops the birthday / work-anniversary milestone reward feature.
--
-- Safe to run: this was configured but never switched on. Verified in
-- production before writing this migration --
--   * all 5 MilestoneConfig rows had isActive = false
--   * MilestoneAward had 0 rows, ever
--   * 0 MILESTONE / MILESTONE_REWARD notifications were ever sent
--   * 0 PointTransaction rows of type MILESTONE
-- The two Cloud Scheduler crons that drove it had never fired successfully:
-- they authenticated with the literal placeholder secret, which the route
-- rejected with a 500 by design.
--
-- PointTransactionType.MILESTONE is deliberately NOT dropped. It is a separate
-- enum, dropping a value is a far riskier migration, and it costs nothing to
-- leave in place.

-- DropForeignKey
ALTER TABLE "MilestoneAward" DROP CONSTRAINT "MilestoneAward_userId_fkey";

-- DropForeignKey
ALTER TABLE "MilestoneConfig" DROP CONSTRAINT "MilestoneConfig_updatedById_fkey";

-- DropTable
DROP TABLE "MilestoneAward";

-- DropTable
DROP TABLE "MilestoneConfig";

-- DropEnum
DROP TYPE "MilestoneType";
