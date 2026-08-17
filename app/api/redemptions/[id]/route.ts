import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { redemptionStatusEmail } from "@/lib/email/templates";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "FULFILLED"]),
  adminNote: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const redemption = await prisma.redemption.findUnique({ where: { id } });
  if (!redemption) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Guard against a double-PATCH race (e.g. two concurrent REJECTED calls):
    // only apply the transition if status still matches what we read above.
    // A second concurrent request loses the CAS and gets count 0.
    const { count } = await tx.redemption.updateMany({
      where: { id, status: redemption.status },
      data: { status: parsed.data.status, adminNote: parsed.data.adminNote, processedById: user.id },
    });
    if (count === 0) {
      throw new Error("REDEMPTION_STATUS_CONFLICT");
    }
    if (parsed.data.status === "REJECTED") {
      await tx.user.update({
        where: { id: redemption.userId },
        data: { pointsBalance: { increment: redemption.pointsSpent } },
      });
      await tx.pointTransaction.create({
        data: { toUserId: redemption.userId, amount: redemption.pointsSpent, type: "REFUND", note: "Refund: rejected redemption", createdById: user.id },
      });
    }
    return tx.redemption.findUniqueOrThrow({ where: { id } });
  }).catch((err) => {
    if (err instanceof Error && err.message === "REDEMPTION_STATUS_CONFLICT") return null;
    throw err;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "This redemption was already processed by someone else. Refresh and try again." },
      { status: 409 }
    );
  }

  // Notify the employee of their redemption status change
  const [reward, employee] = await Promise.all([
    prisma.reward.findUnique({ where: { id: redemption.rewardId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: redemption.userId }, select: { displayName: true, email: true } }),
  ]);
  const rewardName = reward?.name ?? "reward";
  const statusMessages: Record<string, { title: string; body: string }> = {
    APPROVED: { title: "Redemption approved!", body: `Your redemption for "${rewardName}" has been approved.` },
    REJECTED: { title: "Redemption rejected", body: `Your redemption for "${rewardName}" was rejected. Your points have been refunded.${parsed.data.adminNote ? ` Note: ${parsed.data.adminNote}` : ""}` },
    FULFILLED: { title: "Reward fulfilled!", body: `Your "${rewardName}" has been delivered. Enjoy!` },
  };
  const msg = statusMessages[parsed.data.status];
  const status = parsed.data.status as "APPROVED" | "REJECTED" | "FULFILLED";

  if (msg && employee) {
    await Promise.all([
      createNotification({ userId: redemption.userId, type: `REDEMPTION_${status}`, ...msg }),
      sendMail({
        to: employee.email,
        ...redemptionStatusEmail(
          employee.displayName,
          rewardName,
          status,
          parsed.data.adminNote,
          status === "REJECTED" ? redemption.pointsSpent : undefined,
        ),
      }),
    ]);
  }

  // Written after the transaction resolves rather than inside it — the
  // refund on rejection already committed by this point, so there's no
  // durability gain to holding the row lock any longer for this insert.
  await writeAuditLog({
    actorId: user.id,
    action: "REDEMPTION_STATUS",
    entityType: "Redemption",
    entityId: id,
    target: employee ? { userId: redemption.userId, userName: employee.displayName } : undefined,
    after: {
      rewardName,
      fromStatus: redemption.status,
      toStatus: status,
      ...(status === "REJECTED" ? { refunded: redemption.pointsSpent } : {}),
    },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.redemptionsUser(redemption.userId) },
    { topic: realtimeTopics.redemptionsAdmin },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
    ...(status === "REJECTED"
      ? [
          { topic: realtimeTopics.profile(redemption.userId) },
          { topic: realtimeTopics.pointsTransactions },
          { topic: realtimeTopics.leaderboard },
        ]
      : []),
  ]);

  return NextResponse.json({ data: updated });
}
