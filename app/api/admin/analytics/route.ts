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
    // Full employee list — used for dept breakdown, disengaged, and engagement
    allEmployeesRaw,
    deptPointsRaw,
    openReports,
    pendingMedicineRequests,
    redeemedThisMonth,
    avgBalanceRaw,
    dailyRedemptionsRaw,
    // ── Activity signals: any of these = "engaged in last 30 days" ──────────
    activeByPoints,      // received point transactions
    activeByPosts,       // posted to the feed
    activeByReactions,   // reacted to a post
    activeByComments,    // commented on a post
    activeByGames,       // hosted or joined a game
    activeByRedemptions, // redeemed a reward
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
        id: true, amount: true, type: true, note: true, createdAt: true,
        toUser: { select: { displayName: true } },
        fromUser: { select: { displayName: true } },
      },
    }),

    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, amount: { gt: 0 }, type: "MANUAL_AWARD" },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),

    // All active employees — used for dept breakdown + disengaged list
    prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        pointsBalance: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
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

    prisma.feedback.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.medicineRequest.count({ where: { status: "PENDING" } }),

    prisma.redemption.aggregate({
      where: { createdAt: { gte: monthStart }, status: { in: ["APPROVED", "FULFILLED"] } },
      _sum: { pointsSpent: true },
    }),

    prisma.user.aggregate({
      where: { role: "EMPLOYEE", isActive: true },
      _avg: { pointsBalance: true },
    }),

    prisma.redemption.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { in: ["APPROVED", "FULFILLED"] } },
      select: { createdAt: true, pointsSpent: true },
      orderBy: { createdAt: "asc" },
    }),

    // Activity signal 1: received points
    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, amount: { gt: 0 } },
      select: { toUserId: true },
      distinct: ["toUserId"],
    }),

    // Activity signal 2: posted to the feed
    prisma.socialPost.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { authorId: true },
      distinct: ["authorId"],
    }),

    // Activity signal 3: reacted to a post
    prisma.socialReaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),

    // Activity signal 4: commented on a post
    prisma.socialComment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { authorId: true },
      distinct: ["authorId"],
    }),

    // Activity signal 5: played a game (as host or guest)
    prisma.gameSession.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { hostId: true, guestId: true },
    }),

    // Activity signal 6: redeemed a reward
    prisma.redemption.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  // ── Build active employee set from all activity signals ─────────────────────
  // Only count employees (not managers/HR awarding points, etc.)
  const employeeIdSet = new Set(allEmployeesRaw.map((e) => e.id));
  const activeSet = new Set<string>();

  for (const t of activeByPoints)      if (employeeIdSet.has(t.toUserId))  activeSet.add(t.toUserId);
  for (const p of activeByPosts)       if (employeeIdSet.has(p.authorId))  activeSet.add(p.authorId);
  for (const r of activeByReactions)   if (employeeIdSet.has(r.userId))    activeSet.add(r.userId);
  for (const c of activeByComments)    if (employeeIdSet.has(c.authorId))  activeSet.add(c.authorId);
  for (const g of activeByGames) {
    if (employeeIdSet.has(g.hostId))               activeSet.add(g.hostId);
    if (g.guestId && employeeIdSet.has(g.guestId)) activeSet.add(g.guestId);
  }
  for (const r of activeByRedemptions) if (employeeIdSet.has(r.userId))    activeSet.add(r.userId);

  const engagedCount = activeSet.size;
  const engagementRate = totalEmployees === 0 ? 0 : Math.round((engagedCount / totalEmployees) * 1000) / 10;

  // ── Disengaged = employees not in any activity signal ───────────────────────
  const disengaged = allEmployeesRaw
    .filter((e) => !activeSet.has(e.id))
    .sort((a, b) => a.pointsBalance - b.pointsBalance)
    .slice(0, 15)
    .map((e) => ({
      id: e.id,
      displayName: e.displayName,
      avatarUrl: e.avatarUrl,
      pointsBalance: e.pointsBalance,
      department: e.department ? { name: e.department.name } : null,
    }));

  // ── Department breakdown ────────────────────────────────────────────────────
  type DeptRow = { name: string; totalEmployees: number; activeEmployees: number; pointsThisMonth: number };
  const deptMap = new Map<string, DeptRow>();

  for (const emp of allEmployeesRaw) {
    if (!emp.departmentId || !emp.department) continue;
    if (!deptMap.has(emp.departmentId)) {
      deptMap.set(emp.departmentId, { name: emp.department.name, totalEmployees: 0, activeEmployees: 0, pointsThisMonth: 0 });
    }
    const row = deptMap.get(emp.departmentId)!;
    row.totalEmployees++;
    if (activeSet.has(emp.id)) row.activeEmployees++;
  }

  for (const tx of deptPointsRaw) {
    const deptId = tx.toUser.departmentId;
    if (deptId && deptMap.has(deptId)) deptMap.get(deptId)!.pointsThisMonth += tx.amount;
  }

  const departmentBreakdown = Array.from(deptMap.entries())
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.pointsThisMonth - a.pointsThisMonth);

  // ── Chart data ──────────────────────────────────────────────────────────────
  const dailyMap: Record<string, number> = {};
  for (const tx of dailyPointsRaw) {
    const day = tx.createdAt.toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + tx.amount;
  }
  const dailyPoints = Object.entries(dailyMap).map(([date, points]) => ({ date, points }));

  const dailyRedemptionMap: Record<string, number> = {};
  for (const r of dailyRedemptionsRaw) {
    const day = r.createdAt.toISOString().slice(0, 10);
    dailyRedemptionMap[day] = (dailyRedemptionMap[day] ?? 0) + r.pointsSpent;
  }
  const dailyRedemptions = Object.entries(dailyRedemptionMap).map(([date, points]) => ({ date, points }));

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
      dailyRedemptions,
      engagementRate,
      engagedCount,
      disengaged,
      departmentBreakdown,
      openReports,
      pendingMedicineRequests,
      pointsRedeemedThisMonth: redeemedThisMonth._sum.pointsSpent ?? 0,
      avgPointsBalance: Math.round(avgBalanceRaw._avg.pointsBalance ?? 0),
    },
  });
}
