import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { broadcast } from "@/lib/realtime/broadcast";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admins see all; employees see only their own
  const where = user.role === "EMPLOYEE" ? { userId: user.id } : {};

  const redemptions = await prisma.redemption.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      reward: { select: { name: true, pointCost: true, category: true } },
      user: { select: { displayName: true, email: true } },
      processedBy: { select: { displayName: true } },
    },
  });

  return NextResponse.json({ data: redemptions });
}

const createSchema = z.object({
  rewardId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reward = await prisma.reward.findUnique({
    where: { id: parsed.data.rewardId, isActive: true },
  });

  if (!reward) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  if (user.pointsBalance < reward.pointCost) {
    return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
  }

  // Atomic: deduct points + create redemption + decrement stock
  const redemption = await prisma.$transaction(async (tx) => {
    const created = await tx.redemption.create({
      data: { userId: user.id, rewardId: reward.id, pointsSpent: reward.pointCost, status: "PENDING" },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { pointsBalance: { decrement: reward.pointCost } },
    });
    await tx.pointTransaction.create({
      data: { toUserId: user.id, amount: -reward.pointCost, type: "REDEMPTION", note: `Redeemed: ${reward.name}`, createdById: user.id },
    });
    const stockResult = await tx.reward.updateMany({
      where: { id: reward.id, stockQuantity: { gt: 0 } },
      data: { stockQuantity: { decrement: 1 } },
    });
    if (stockResult.count === 0) {
      throw new Error('Out of stock');
    }
    return created;
  });

  broadcast(`points:${user!.id}`).catch(() => {});

  return NextResponse.json({ data: redemption }, { status: 201 });
}
