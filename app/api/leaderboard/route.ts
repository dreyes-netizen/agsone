import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "monthly";
  const departmentId = searchParams.get("departmentId") ?? null;

  if (period === "monthly") {
    const result = await prisma.pointTransaction.groupBy({
      by: ["toUserId"],
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 50,
    });

    let userIds = result.map((r) => r.toUserId);

    if (departmentId) {
      const deptUsers = await prisma.user.findMany({
        where: { departmentId },
        select: { id: true },
      });
      const deptUserIdSet = new Set(deptUsers.map((u) => u.id));
      userIds = userIds.filter((id) => deptUserIdSet.has(id));
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } },
    });

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const filteredResult = result.filter((r) => userIds.includes(r.toUserId));

    const entries = filteredResult.map((r, i) => ({
      rank: i + 1,
      userId: r.toUserId,
      displayName: userMap[r.toUserId]?.displayName ?? "Unknown",
      avatarUrl: userMap[r.toUserId]?.avatarUrl ?? null,
      department: userMap[r.toUserId]?.department?.name ?? null,
      points: r._sum.amount ?? 0,
      isCurrentUser: r.toUserId === user.id,
    }));

    return NextResponse.json({ data: entries, period });
  }

  // All-time: rank by pointsBalance
  const users = await prisma.user.findMany({
    where: departmentId ? { departmentId } : {},
    orderBy: { pointsBalance: "desc" },
    take: 50,
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      pointsBalance: true,
      level: true,
      department: { select: { name: true } },
    },
  });

  const entries = users.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    department: u.department?.name ?? null,
    points: u.pointsBalance,
    level: u.level,
    isCurrentUser: u.id === user.id,
  }));

  return NextResponse.json({ data: entries, period });
}
