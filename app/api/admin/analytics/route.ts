import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const actor = await verifyAuth(req);
  if (!requireRole(actor, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Build daily points-awarded data for the last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalEmployees,
    pointsThisMonth,
    pointsLastMonth,
    pendingRedemptions,
    activeGames,
    topEarners,
    recentTransactions,
    dailyPointsRaw,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE" } }),

    prisma.pointTransaction.aggregate({
      where: { createdAt: { gte: monthStart }, amount: { gt: 0 }, type: { not: "GAME_WIN" } },
      _sum: { amount: true },
    }),

    prisma.pointTransaction.aggregate({
      where: { createdAt: { gte: lastMonthStart, lt: monthStart }, amount: { gt: 0 }, type: { not: "GAME_WIN" } },
      _sum: { amount: true },
    }),

    prisma.redemption.count({ where: { status: "PENDING" } }),

    prisma.game.count({ where: { isActive: true } }),

    prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      orderBy: { pointsBalance: "desc" },
      take: 5,
      select: { id: true, displayName: true, pointsBalance: true, level: true, avatarUrl: true },
    }),

    prisma.pointTransaction.findMany({
      where: { amount: { gt: 0 }, type: { in: ["MANUAL_AWARD", "GAME_WIN", "ATTENDANCE"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        type: true,
        note: true,
        createdAt: true,
        toUser: { select: { displayName: true } },
        fromUser: { select: { displayName: true } },
      },
    }),

    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, amount: { gt: 0 }, type: "MANUAL_AWARD" },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Aggregate daily for chart
  const dailyMap: Record<string, number> = {};
  for (const tx of dailyPointsRaw) {
    const day = tx.createdAt.toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + tx.amount;
  }
  const dailyPoints = Object.entries(dailyMap).map(([date, points]) => ({ date, points }));

  const thisMonth = pointsThisMonth._sum.amount ?? 0;
  const lastMonth = pointsLastMonth._sum.amount ?? 0;
  const monthGrowth = lastMonth === 0 ? null : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

  return NextResponse.json({
    data: {
      totalEmployees,
      pointsThisMonth: thisMonth,
      monthGrowth,
      pendingRedemptions,
      activeGames,
      topEarners,
      recentTransactions,
      dailyPoints,
    },
  });
}
