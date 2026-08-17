import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { pointsReceivedEmail } from "@/lib/email/templates";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { findActivity, AWARD_CATEGORIES } from "@/lib/constants/awardActivities";
import {
  checkManagerBudget,
  budgetPeriodKey,
  BUDGET_LOW_THRESHOLD,
} from "@/lib/helpers/checkManagerBudget";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
import { z } from "zod";

const schema = z.object({
  toUserId: z.string().uuid(),
  amount: z.number().int().min(1).max(10000),
  note: z.string().min(1).max(500),
  activity: z.string().optional(),
  category: z.enum(Object.keys(AWARD_CATEGORIES) as [string, ...string[]]).optional(),
});

export async function POST(req: NextRequest) {
  const actor = await verifyAuth(req);
  if (!requireRole(actor, ["MANAGER", "HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(actor.id, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { toUserId, note, activity } = parsed.data;
  let { amount, category } = parsed.data;

  // Activity presets carry the manual's standard point value — the server
  // resolves it so clients can't tamper with preset amounts.
  if (activity) {
    const preset = findActivity(activity);
    if (!preset) {
      return NextResponse.json({ error: "Unknown award activity" }, { status: 400 });
    }
    amount = preset.points;
    category = preset.category;
  }

  // Prevent self-award
  if (toUserId === actor.id) {
    return NextResponse.json({ error: "Cannot award points to yourself" }, { status: 400 });
  }

  // The budget check and recipient lookup are independent of each other —
  // fetch both concurrently instead of one after the other.
  const [budget, recipient] = await Promise.all([
    // Manual §3: managers have a 500 pts/month budget (HR_ADMIN exempt)
    checkManagerBudget(actor.id, actor.role, amount),
    prisma.user.findUnique({ where: { id: toUserId } }),
  ]);
  if (!budget.allowed) {
    // A manager's only signal that they had hit the cap used to be this 400 —
    // a transient toast, mid-action, with nothing left behind. Leave a record
    // in their bell so it's still there when they wonder why an award failed.
    // Grouped per period, so repeated attempts collapse into one row.
    void createNotification({
      userId: actor.id,
      type: "BUDGET_EXHAUSTED",
      title: "Monthly award budget spent",
      body: `You have ${budget.remaining} pts left this month, so a ${amount} pt award could not be sent. The budget resets on the 1st.`,
      data: { period: budgetPeriodKey(), remaining: budget.remaining },
    }).catch((err) => console.error("budget exhausted notification failed", err));

    return NextResponse.json(
      { error: `Budget exceeded. You have ${budget.remaining} pts remaining this month.` },
      { status: 400 },
    );
  }
  if (!recipient) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Only Super Admin can award points to Managers and other elevated roles
  if (recipient.role !== "EMPLOYEE" && actor.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admin can award points to Managers" }, { status: 403 });
  }

  // Atomic: update balance + create transaction
  const { transaction, newBalance } = await prisma.$transaction(async (tx) => {
    const created = await tx.pointTransaction.create({
      data: { fromUserId: actor.id, toUserId, amount, type: "MANUAL_AWARD", note, category: category ?? null, activity: activity ?? null, createdById: actor.id },
    });
    const updatedUser = await tx.user.update({
      where: { id: toUserId },
      data: { pointsBalance: { increment: amount } },
      select: { pointsBalance: true },
    });
    return { transaction: created, newBalance: updatedUser.pointsBalance };
  });

  // Fire-and-forget: notification + feed post + email
  // actor.displayName is already known from verifyAuth — no need to re-query it.
  const actorName = actor.displayName;

  await Promise.all([
    createNotification({
      userId: toUserId,
      type: "POINTS_RECEIVED",
      title: `You received ${amount.toLocaleString()} points!`,
      body: note,
      data: { amount, fromUserId: actor.id },
    }),
    prisma.socialPost.create({
      data: {
        authorId: actor.id,
        type: "CELEBRATION",
        content: `🎉 ${recipient.displayName} received ${amount.toLocaleString()} points from ${actorName}! "${note}"`,
        referenceId: transaction.id,
      },
    }),
    sendMail({
      to: recipient.email,
      ...pointsReceivedEmail(recipient.displayName, amount, actorName, note, newBalance),
    }),
  ]);

  // Warn the manager when this award takes them past 80% of the monthly cap.
  // `budget` was computed before the award, so subtract what was just spent.
  // Grouped per period in the catalog, so this fires once a month rather than
  // on every subsequent award. Exempt roles have no cap to warn about.
  if (!budget.isExempt) {
    const remainingAfter = Math.max(0, budget.remaining - amount);
    const spentShare = 1 - remainingAfter / budget.total;
    if (remainingAfter > 0 && spentShare >= BUDGET_LOW_THRESHOLD) {
      void createNotification({
        userId: actor.id,
        type: "BUDGET_LOW",
        title: "Award budget running low",
        body: `${remainingAfter} of ${budget.total} pts left this month. The budget resets on the 1st.`,
        data: { period: budgetPeriodKey(), remaining: remainingAfter },
      }).catch((err) => console.error("budget low notification failed", err));
    }
  }

  // Check badge milestones + level-up (fire-and-forget)
  prisma.pointTransaction.aggregate({ where: { toUserId: toUserId, amount: { gt: 0 } }, _sum: { amount: true } })
    .then((agg) => checkAndAwardBadges({ userId: toUserId, totalEarned: agg._sum.amount ?? 0 }))
    .catch((err) => console.error("checkAndAwardBadges failed", err));
  checkLevelUp(toUserId, newBalance).catch((err) => console.error("checkLevelUp failed", err));

  await writeAuditLog({
    actorId: actor.id,
    action: "AWARD_POINTS",
    entityType: "PointTransaction",
    entityId: transaction.id,
    target: { userId: toUserId, userName: recipient.displayName },
    after: { amount, note },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.profile(toUserId) },
    { topic: realtimeTopics.pointsTransactions },
    { topic: realtimeTopics.leaderboard },
    { topic: realtimeTopics.feed },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: transaction });
}
