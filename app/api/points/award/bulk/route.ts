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
  userIds: z.array(z.string().uuid()).min(1).max(200),
  amount: z.number().int().min(1).max(10000),
  note: z.string().min(1).max(500),
  activity: z.string().optional(),
  category: z.enum(Object.keys(AWARD_CATEGORIES) as [string, ...string[]]).optional(),
});

export async function POST(req: NextRequest) {
  const actor = await verifyAuth(req);
  if (!requireRole(actor, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userIds, note } = parsed.data;
  let { amount, category, activity } = parsed.data;

  // Activity presets carry the manual's standard point value — server-resolved
  // so clients can't tamper with preset amounts.
  if (activity) {
    const preset = findActivity(activity);
    if (!preset) {
      return NextResponse.json({ error: "Unknown award activity" }, { status: 400 });
    }
    amount = preset.points;
    category = preset.category;
  }

  // Remove self
  const targetIds = userIds.filter((id) => id !== actor!.id);
  if (targetIds.length === 0) {
    return NextResponse.json({ error: "No valid recipients" }, { status: 400 });
  }

  const recipients = await prisma.user.findMany({
    where: { id: { in: targetIds }, isActive: true },
    select: { id: true, displayName: true, email: true, pointsBalance: true },
  });

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No active recipients found" }, { status: 400 });
  }

  // Manual §3: managers have a 500 pts/month budget; bulk cost is amount × recipients
  const totalCost = amount * recipients.length;
  const budget = await checkManagerBudget(actor!.id, actor!.role, totalCost);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `Budget exceeded. Awarding ${amount} pts to ${recipients.length} recipients costs ${totalCost} pts, but you only have ${budget.remaining} pts remaining this month.` },
      { status: 400 },
    );
  }

  const recipientIds = recipients.map((r) => r.id);

  await prisma.$transaction([
    prisma.pointTransaction.createMany({
      data: recipientIds.map((id) => ({
        fromUserId: actor!.id,
        toUserId: id,
        amount,
        type: "MANUAL_AWARD",
        note,
        category: category ?? null,
        activity: activity ?? null,
        createdById: actor!.id,
      })),
    }),
    prisma.user.updateMany({
      where: { id: { in: recipientIds } },
      data: { pointsBalance: { increment: amount } },
    }),
  ]);

  // Re-fetch updated balances after the transaction commits to avoid stale reads
  const updatedRecipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, pointsBalance: true, level: true },
  });
  const balanceMap = new Map(updatedRecipients.map((u) => [u.id, u.pointsBalance]));

  const actorUser = await prisma.user.findUnique({
    where: { id: actor!.id },
    select: { displayName: true },
  });
  const actorName = actorUser?.displayName ?? "Someone";

  // One feed post for the bulk award
  prisma.socialPost.create({
    data: {
      authorId: actor!.id,
      type: "CELEBRATION",
      content: `🎉 ${actorName} awarded ${amount.toLocaleString()} points to ${recipients.length} employee${recipients.length !== 1 ? "s" : ""}! "${note}"`,
    },
  }).catch(() => {});

  // Single audit log
  prisma.auditLog.create({
    data: {
      actorId: actor!.id,
      action: "BULK_AWARD_POINTS",
      entityType: "PointTransaction",
      entityId: actor!.id,
      afterState: { recipientIds, amount, note, count: recipients.length },
    },
  }).catch(() => {});

  // Per-user: notification + email + badges + level-up
  for (const r of recipients) {
    const newBalance = balanceMap.get(r.id) ?? (r.pointsBalance + amount);
    createNotification({
      userId: r.id,
      type: "POINTS_RECEIVED",
      title: `You received ${amount.toLocaleString()} points!`,
      body: note,
      data: { amount, fromUserId: actor!.id },
    }).catch(() => {});
    sendMail({
      to: r.email,
      ...pointsReceivedEmail(r.displayName, amount, actorName, note, newBalance),
    }).catch(() => {});
    checkLevelUp(r.id, newBalance).catch(() => {});
    prisma.pointTransaction
      .aggregate({ where: { toUserId: r.id, amount: { gt: 0 } }, _sum: { amount: true } })
      .then((agg) => checkAndAwardBadges({ userId: r.id, totalEarned: agg._sum.amount ?? 0 }))
      .catch(() => {});
  }

  // Notify each recipient's browser to refresh their points balance
  Promise.all(recipients.map((r) => broadcast(`points:${r.id}`))).catch(() => {});

  return NextResponse.json({ data: { awarded: recipients.length } });
}
