import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants/stock";

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
    topEarners,
    dailyPointsRaw,
    openReports,
    pendingMedicineRequests,
    redeemedThisMonth,
    avgBalanceRaw,
    dailyRedemptionsRaw,
    // ── Action Queue sources — oldest-first, capped, indexed ────────────────
    pendingRedemptionsList,
    pendingMedicineList,
    openReportsList,
    // ── Stock Alerts sources ────────────────────────────────────────────────
    lowStockRewards,
    lowStockMedicine,
    // ── Recent Admin Activity ───────────────────────────────────────────────
    recentAudit,
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

    prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      orderBy: { pointsBalance: "desc" },
      take: 5,
      select: { id: true, displayName: true, pointsBalance: true, level: true, avatarUrl: true },
    }),

    prisma.pointTransaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, amount: { gt: 0 }, type: "MANUAL_AWARD" },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: "asc" },
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

    prisma.redemption.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        pointsSpent: true,
        createdAt: true,
        user: { select: { displayName: true, avatarUrl: true } },
        reward: { select: { name: true } },
      },
    }),

    prisma.medicineRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        user: { select: { displayName: true, avatarUrl: true } },
        medicine: { select: { name: true } },
      },
    }),

    prisma.feedback.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        category: true,
        isAnonymous: true,
        createdAt: true,
        author: { select: { displayName: true, avatarUrl: true } },
      },
    }),

    // gte: 0 excludes the -1 "unlimited stock" sentinel
    prisma.reward.findMany({
      where: { isActive: true, stockQuantity: { gte: 0, lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stockQuantity: "asc" },
      take: 10,
      select: { id: true, name: true, stockQuantity: true },
    }),

    // MedicineItem has no unlimited-stock sentinel — no gte guard needed
    prisma.medicineItem.findMany({
      where: { isActive: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: { stockQuantity: "asc" },
      take: 10,
      select: { id: true, name: true, stockQuantity: true },
    }),

    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        beforeState: true,
        afterState: true,
        createdAt: true,
        actor: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
      },
    }),
  ]);

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

  // ── Action Queue — merge redemptions, medicine requests, and reports ────────
  // Anonymous reports are sanitized here, server-side, the same way
  // /api/admin/feedback does it — never send the author for an anonymous
  // report and rely on the UI to hide it.
  type ActionItem = {
    kind: "REDEMPTION" | "MEDICINE" | "REPORT";
    id: string;
    title: string;
    actorName: string | null;
    actorAvatar: string | null;
    meta: string | null;
    createdAt: string;
  };

  const actionQueue: ActionItem[] = [
    ...pendingRedemptionsList.map((r): ActionItem => ({
      kind: "REDEMPTION",
      id: r.id,
      title: r.reward.name,
      actorName: r.user.displayName,
      actorAvatar: r.user.avatarUrl,
      meta: `${r.pointsSpent.toLocaleString()} pts`,
      createdAt: r.createdAt.toISOString(),
    })),
    ...pendingMedicineList.map((m): ActionItem => ({
      kind: "MEDICINE",
      id: m.id,
      title: `${m.medicine.name} ×${m.quantity}`,
      actorName: m.user.displayName,
      actorAvatar: m.user.avatarUrl,
      meta: null,
      createdAt: m.createdAt.toISOString(),
    })),
    ...openReportsList.map((f): ActionItem => ({
      kind: "REPORT",
      id: f.id,
      title: f.title,
      actorName: f.isAnonymous ? null : f.author?.displayName ?? null,
      actorAvatar: f.isAnonymous ? null : f.author?.avatarUrl ?? null,
      meta: f.category.replace(/_/g, " "),
      createdAt: f.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 10);

  // ── Stock Alerts — merge low/out-of-stock rewards and medicine ─────────────
  type StockItem = { kind: "REWARD" | "MEDICINE"; id: string; name: string; stockQuantity: number };

  const stockAlerts: StockItem[] = [
    ...lowStockRewards.map((r): StockItem => ({ kind: "REWARD", id: r.id, name: r.name, stockQuantity: r.stockQuantity })),
    ...lowStockMedicine.map((m): StockItem => ({ kind: "MEDICINE", id: m.id, name: m.name, stockQuantity: m.stockQuantity })),
  ]
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, 10);

  // ── Recent Admin Activity — resolve unnamed toUserId refs, same as /api/admin/audit ──
  const unresolvedIds = recentAudit
    .map((l) => (l.afterState as Record<string, unknown> | null)?.toUserId as string | undefined)
    .filter((id, idx, arr): id is string => {
      if (!id) return false;
      const entry = recentAudit[idx];
      return !(entry.afterState as Record<string, unknown> | null)?.toUserName;
    });

  const uniqueIds = [...new Set(unresolvedIds)];
  let nameMap: Record<string, string> = {};
  if (uniqueIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, displayName: true },
    });
    nameMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));
  }

  const recentActivity = recentAudit.map((log) => {
    const after = log.afterState as Record<string, unknown> | null;
    if (after?.toUserId && !after?.toUserName && nameMap[after.toUserId as string]) {
      return { ...log, afterState: { ...after, toUserName: nameMap[after.toUserId as string] } };
    }
    return log;
  });

  return NextResponse.json({
    data: {
      totalEmployees,
      pointsThisMonth: thisMonth,
      monthGrowth,
      pendingRedemptions,
      topEarners,
      dailyPoints,
      dailyRedemptions,
      openReports,
      pendingMedicineRequests,
      pointsRedeemedThisMonth: redeemedThisMonth._sum.pointsSpent ?? 0,
      avgPointsBalance: Math.round(avgBalanceRaw._avg.pointsBalance ?? 0),
      actionQueue,
      stockAlerts,
      recentActivity,
      counts: {
        redemptions: pendingRedemptions,
        medicine: pendingMedicineRequests,
        reports: openReports,
      },
    },
  });
}
