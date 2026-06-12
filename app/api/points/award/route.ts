import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { pointsReceivedEmail } from "@/lib/email/templates";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { broadcast } from "@/lib/realtime/broadcast";
import { findActivity, AWARD_CATEGORIES } from "@/lib/constants/awardActivities";
import { checkManagerBudget } from "@/lib/helpers/checkManagerBudget";
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

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { toUserId, note } = parsed.data;
  let { amount, category, activity } = parsed.data;

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
  if (toUserId === actor!.id) {
    return NextResponse.json({ error: "Cannot award points to yourself" }, { status: 400 });
  }

  // Manual §3: managers have a 500 pts/month budget (HR_ADMIN exempt)
  const budget = await checkManagerBudget(actor!.id, actor!.role, amount);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `Budget exceeded. You have ${budget.remaining} pts remaining this month.` },
      { status: 400 },
    );
  }

  // Verify recipient exists
  const recipient = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!recipient) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Only Super Admin can award points to Managers and other elevated roles
  if (recipient.role !== "EMPLOYEE" && actor!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admin can award points to Managers" }, { status: 403 });
  }

  // Atomic: update balance + create transaction
  const { transaction, newBalance } = await prisma.$transaction(async (tx) => {
    const created = await tx.pointTransaction.create({
      data: { fromUserId: actor!.id, toUserId, amount, type: "MANUAL_AWARD", note, category: category ?? null, activity: activity ?? null, createdById: actor!.id },
    });
    const updatedUser = await tx.user.update({
      where: { id: toUserId },
      data: { pointsBalance: { increment: amount } },
      select: { pointsBalance: true },
    });
    return { transaction: created, newBalance: updatedUser.pointsBalance };
  });

  // Fire-and-forget: notification + feed post + email
  const actorUser = await prisma.user.findUnique({ where: { id: actor!.id }, select: { displayName: true } });
  const actorName = actorUser?.displayName ?? "Someone";

  await Promise.all([
    createNotification({
      userId: toUserId,
      type: "POINTS_RECEIVED",
      title: `You received ${amount.toLocaleString()} points!`,
      body: note,
      data: { amount, fromUserId: actor!.id },
    }),
    prisma.socialPost.create({
      data: {
        authorId: actor!.id,
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

  // Notify recipient's browser to refresh points balance in real-time
  broadcast(`points:${toUserId}`).catch(() => {});

  // Check badge milestones + level-up (fire-and-forget)
  prisma.pointTransaction.aggregate({ where: { toUserId: toUserId, amount: { gt: 0 } }, _sum: { amount: true } })
    .then((agg) => checkAndAwardBadges({ userId: toUserId, totalEarned: agg._sum.amount ?? 0 }))
    .catch(() => {});
  checkLevelUp(toUserId, newBalance).catch(() => {});

  await prisma.auditLog.create({
    data: {
      actorId: actor!.id,
      action: "AWARD_POINTS",
      entityType: "PointTransaction",
      entityId: transaction.id,
      afterState: { toUserId, amount, note },
    },
  });

  return NextResponse.json({ data: transaction });
}
