import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { pointsReceivedEmail } from "@/lib/email/templates";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { z } from "zod";

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(200),
  amount: z.number().int().min(1).max(10000),
  note: z.string().min(1).max(500),
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

  const { userIds, amount, note } = parsed.data;

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

  const recipientIds = recipients.map((r) => r.id);

  await prisma.$transaction([
    prisma.pointTransaction.createMany({
      data: recipientIds.map((id) => ({
        fromUserId: actor!.id,
        toUserId: id,
        amount,
        type: "MANUAL_AWARD",
        note,
        createdById: actor!.id,
      })),
    }),
    prisma.user.updateMany({
      where: { id: { in: recipientIds } },
      data: { pointsBalance: { increment: amount } },
    }),
  ]);

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
    const newBalance = r.pointsBalance + amount;
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

  return NextResponse.json({ data: { awarded: recipients.length } });
}
