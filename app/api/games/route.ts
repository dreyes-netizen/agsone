import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const games = await prisma.game.findMany({
    where: {
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
  });

  // For each game, how many times has this user played today?
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const playsToday = await prisma.gamePlay.groupBy({
    by: ["gameId"],
    where: { userId: user.id, playedAt: { gte: todayStart } },
    _count: { id: true },
  });
  const playCountMap = Object.fromEntries(playsToday.map((p: { gameId: string; _count: { id: number } }) => [p.gameId, p._count.id]));

  const enriched = games.map((g) => ({
    ...g,
    playsToday: playCountMap[g.id] ?? 0,
    canPlay: (playCountMap[g.id] ?? 0) < g.dailyPlaysLimit,
  }));

  return NextResponse.json({ data: enriched });
}
