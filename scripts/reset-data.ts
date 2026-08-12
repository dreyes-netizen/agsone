import "dotenv/config";
import { PrismaClient, MedicineRequestStatus } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Clean-slate data reset before a first production deploy (AGSON-76).
 *
 * Wipes user-generated/transactional content (feed posts + comments/reactions/
 * polls, medicine requests, food listings/orders, minigame sessions/plays,
 * notifications, chat sessions, feedback, audit logs, and the points ledger)
 * while preserving the employee roster (User) and every admin-configured
 * catalog table (Reward, Badge, MedicineItem, Department, MilestoneConfig,
 * Game, AppSetting, PolicyDocument).
 *
 * Dry run by default: prints current row counts and exits. Pass --confirm to
 * actually delete anything.
 *
 * IMPORTANT: this deliberately does NOT use `prisma migrate reset`.
 * ShoutoutRecipient, MedicineItem, MedicineRequest, and GameSession were
 * applied via `prisma db push` and have no CREATE TABLE migration in
 * prisma/migrations/ — a migrate reset would silently fail to recreate them.
 */

// Set true to keep MilestoneAward rows, so the milestone cron treats this
// year's birthday/anniversary payouts as already made instead of re-awarding
// them from the zeroed balance on its next run.
const PRESERVE_MILESTONE_AWARDS = false;

const CONFIRM = process.argv.includes("--confirm");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return "(DATABASE_URL not set)";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? "***:***@" : ""}${u.host}${u.pathname}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

async function readCounts() {
  return {
    // wiped
    pollVote: await prisma.pollVote.count(),
    socialReaction: await prisma.socialReaction.count(),
    shoutoutRecipient: await prisma.shoutoutRecipient.count(),
    socialComment: await prisma.socialComment.count(),
    chatMessage: await prisma.chatMessage.count(),
    feedbackReply: await prisma.feedbackReply.count(),
    foodOrder: await prisma.foodOrder.count(),
    gamePlay: await prisma.gamePlay.count(),
    medicineRequest: await prisma.medicineRequest.count(),
    redemption: await prisma.redemption.count(),
    userBadge: await prisma.userBadge.count(),
    milestoneAward: await prisma.milestoneAward.count(),
    notification: await prisma.notification.count(),
    auditLog: await prisma.auditLog.count(),
    gameSession: await prisma.gameSession.count(),
    pointTransaction: await prisma.pointTransaction.count(),
    pollOption: await prisma.pollOption.count(),
    socialPost: await prisma.socialPost.count(),
    feedback: await prisma.feedback.count(),
    foodListing: await prisma.foodListing.count(),
    chatSession: await prisma.chatSession.count(),
    // kept
    user: await prisma.user.count(),
    department: await prisma.department.count(),
    reward: await prisma.reward.count(),
    badge: await prisma.badge.count(),
    medicineItem: await prisma.medicineItem.count(),
    milestoneConfig: await prisma.milestoneConfig.count(),
    game: await prisma.game.count(),
    appSetting: await prisma.appSetting.count(),
    policyDocument: await prisma.policyDocument.count(),
  };
}

async function main() {
  console.log(`Target database: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log(
    PRESERVE_MILESTONE_AWARDS
      ? "MilestoneAward rows will be PRESERVED (this year's milestones are treated as already paid).\n"
      : "MilestoneAward rows will be DELETED (the milestone cron will re-award this year's birthday/anniversary points from the zeroed balance on its next run).\n"
  );

  const before = await readCounts();
  console.log("Current row counts:");
  console.table(before);

  // Reward.stockQuantity is only ever decremented on redemption
  // (app/api/redemptions/route.ts). If any redemption has ever run, this
  // script's assumption that reward stock is untouched no longer holds.
  if (before.redemption > 0) {
    console.error(
      `\nAborting: found ${before.redemption} Redemption row(s). This script assumes Reward.stockQuantity is pristine because no redemption has ever run — that assumption no longer holds. Resolve manually (restore stock, or extend this script) before proceeding.`
    );
    process.exit(1);
  }

  if (!CONFIRM) {
    console.log("\nDry run only — nothing was deleted. Re-run with --confirm to execute.");
    return;
  }

  // Capture exactly how much stock the demo/test approvals consumed, before
  // deleting the MedicineRequest rows that caused the decrement
  // (app/api/admin/medicine/requests/[id]/route.ts only decrements
  // MedicineItem.stockQuantity on APPROVED — never on PENDING/REJECTED).
  const consumedStock = await prisma.medicineRequest.groupBy({
    by: ["medicineId"],
    where: { status: MedicineRequestStatus.APPROVED },
    _sum: { quantity: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    // Delete order matches the FK dependency tiers: leaves first (nothing
    // depends on them), then their parents. 27 of 36 FKs in this schema are
    // ON DELETE RESTRICT, so this order is mandatory, not stylistic.
    const deleted = {
      pollVote: (await tx.pollVote.deleteMany({})).count,
      socialReaction: (await tx.socialReaction.deleteMany({})).count,
      shoutoutRecipient: (await tx.shoutoutRecipient.deleteMany({})).count,
      socialComment: (await tx.socialComment.deleteMany({})).count,
      chatMessage: (await tx.chatMessage.deleteMany({})).count,
      feedbackReply: (await tx.feedbackReply.deleteMany({})).count,
      foodOrder: (await tx.foodOrder.deleteMany({})).count,
      gamePlay: (await tx.gamePlay.deleteMany({})).count,
      medicineRequest: (await tx.medicineRequest.deleteMany({})).count,
      redemption: (await tx.redemption.deleteMany({})).count,
      userBadge: (await tx.userBadge.deleteMany({})).count,
      milestoneAward: PRESERVE_MILESTONE_AWARDS ? 0 : (await tx.milestoneAward.deleteMany({})).count,
      notification: (await tx.notification.deleteMany({})).count,
      auditLog: (await tx.auditLog.deleteMany({})).count,
      gameSession: (await tx.gameSession.deleteMany({})).count,
      pointTransaction: (await tx.pointTransaction.deleteMany({})).count,
      // tier 2: parents of the above
      pollOption: (await tx.pollOption.deleteMany({})).count,
      socialPost: (await tx.socialPost.deleteMany({})).count,
      feedback: (await tx.feedback.deleteMany({})).count,
      foodListing: (await tx.foodListing.deleteMany({})).count,
      chatSession: (await tx.chatSession.deleteMany({})).count,
    };

    for (const row of consumedStock) {
      const qty = row._sum.quantity ?? 0;
      if (qty > 0) {
        await tx.medicineItem.update({
          where: { id: row.medicineId },
          data: { stockQuantity: { increment: qty } },
        });
      }
    }

    // pointsBalance is a running total fed by PointTransaction; level is a
    // one-way ratchet (lib/helpers/checkLevelUp.ts never lowers it). Both
    // must be reset explicitly — deleting the ledger alone leaves them wrong.
    const { count: usersReset } = await tx.user.updateMany({
      data: { pointsBalance: 0, level: 1 },
    });

    return { deleted, usersReset, stockRestoredCount: consumedStock.length };
  });

  console.log("\nDeleted:");
  console.table(result.deleted);
  console.log(`Reset pointsBalance=0, level=1 on ${result.usersReset} user(s).`);
  console.log(`Restored stock on ${result.stockRestoredCount} medicine item(s).`);

  const after = await readCounts();
  console.log("\nRow counts after reset:");
  console.table(after);

  console.log("\n✅ Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
