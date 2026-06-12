import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const actor = await verifyAuth(req);
  if (!requireRole(actor, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
    activeUserIdsRaw,
    disengaged,
    deptEmployeesRaw,
    deptPointsRaw,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),

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
      where: { role: "EMPLOYEE", isActive: true },
      orderBy: { pointsBalance: "desc" },
      take: 5,
      select: { id: true, displayName: true, pointsBalance: true, level: true, avatarUrl: true },
    }),

    prisma.pointTransaction.findMany({
      where: { amount: { gt: 0 }, type: { in: ["MANUAL_AWARD", "GAME_WIN"] } },
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

    // Distinct employees who received points in last 30 days
    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, amount: { gt: 0 }, toUser: { role: "EMPLOYEE" } },
      select: { toUserId: true },
      distinct: ["toUserId"],
    }),

    // Employees with no received transactions in last 30 days
    prisma.user.findMany({
      where: {
        role: "EMPLOYEE",
        isActive: true,
        pointsReceived: { none: { createdAt: { gte: thirtyDaysAgo } } },
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        pointsBalance: true,
        department: { select: { name: true } },
      },
      orderBy: { pointsBalance: "asc" },
      take: 15,
    }),

    // All active employees with their department
    prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: { id: true, departmentId: true, department: { select: { id: true, name: true } } },
    }),

    // Points awarded this month grouped by recipient's department
    prisma.pointTransaction.findMany({
      where: {
        createdAt: { gte: monthStart },
        amount: { gt: 0 },
        toUser: { role: "EMPLOYEE", departmentId: { not: null } },
      },
      select: { amount: true, toUser: { select: { departmentId: true } } },
    }),
  ]);

  // Engagement metrics
  const activeSet = new Set(activeUserIdsRaw.map((r) => r.toUserId));
  const engagedCount = activeSet.size;
  const engagementRate = totalEmployees === 0 ? 0 : Math.round((engagedCount / totalEmployees) * 1000) / 10;

  // Department breakdown
  type DeptRow = { name: string; totalEmployees: number; activeEmployees: number; pointsThisMonth: number };
  const deptMap = new Map<string, DeptRow>();

  for (const emp of deptEmployeesRaw) {
    if (!emp.departmentId || !emp.department) continue;
    if (!deptMap.has(emp.departmentId)) {
      deptMap.set(emp.departmentId, {
        name: emp.department.name,
        totalEmployees: 0,
        activeEmployees: 0,
        pointsThisMonth: 0,
      });
    }
    const row = deptMap.get(emp.departmentId)!;
    row.totalEmployees++;
    if (activeSet.has(emp.id)) row.activeEmployees++;
  }

  for (const tx of deptPointsRaw) {
    const deptId = tx.toUser.departmentId;
    if (deptId && deptMap.has(deptId)) {
      deptMap.get(deptId)!.pointsThisMonth += tx.amount;
    }
  }

  const departmentBreakdown = Array.from(deptMap.entries())
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.pointsThisMonth - a.pointsThisMonth);

  // Daily chart data
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
      engagementRate,
      engagedCount,
      disengaged,
      departmentBreakdown,
    },
  });
}
