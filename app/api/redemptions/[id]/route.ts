import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { redemptionStatusEmail } from "@/lib/email/templates";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "FULFILLED"]),
  adminNote: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
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
    const result = await tx.redemption.update({
      where: { id },
      data: { status: parsed.data.status, adminNote: parsed.data.adminNote, processedById: user!.id },
    });
    if (parsed.data.status === "REJECTED") {
      await tx.user.update({
        where: { id: redemption.userId },
        data: { pointsBalance: { increment: redemption.pointsSpent } },
      });
      await tx.pointTransaction.create({
        data: { toUserId: redemption.userId, amount: redemption.pointsSpent, type: "REFUND", note: "Refund: rejected redemption", createdById: user!.id },
      });
    }
    return result;
  });

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

  return NextResponse.json({ data: updated });
}
