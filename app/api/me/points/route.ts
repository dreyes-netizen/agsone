import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [userData, transactions, redemptions, totalEarnedAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { pointsBalance: true, level: true },
    }),
    prisma.pointTransaction.findMany({
      where: { toUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amount: true,
        type: true,
        note: true,
        createdAt: true,
        fromUser: { select: { displayName: true } },
      },
    }),
    prisma.redemption.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pointsSpent: true,
        createdAt: true,
        reward: { select: { name: true } },
      },
    }),
    prisma.pointTransaction.aggregate({
      where: { toUserId: user.id, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      balance: userData?.pointsBalance ?? 0,
      level: userData?.level ?? 1,
      totalEarned: totalEarnedAgg._sum.amount ?? 0,
      transactions,
      redemptions,
    },
  });
}
