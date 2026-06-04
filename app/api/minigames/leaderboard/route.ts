import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

/**
 * Minigames leaderboard — ranks players by wins across FINISHED games.
 * Computed by tallying GameSession rows (no denormalized counters), which is
 * fine at this scale. Tiebreak by win rate; a minimum of 1 game to appear.
 */
export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "alltime";

  const createdAtFilter =
    period === "monthly"
      ? { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      : undefined;

  const sessions = await prisma.gameSession.findMany({
    where: { status: "FINISHED", ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
    select: { hostId: true, guestId: true, winnerId: true },
  });

  // Tally per participant.
  const tally: Record<string, { wins: number; losses: number; draws: number }> = {};
  const bump = (uid: string | null, key: "wins" | "losses" | "draws") => {
    if (!uid) return;
    (tally[uid] ??= { wins: 0, losses: 0, draws: 0 })[key]++;
  };

  for (const s of sessions) {
    const players = [s.hostId, s.guestId].filter(Boolean) as string[];
    for (const p of players) {
      if (s.winnerId === null) bump(p, "draws");
      else if (s.winnerId === p) bump(p, "wins");
      else bump(p, "losses");
    }
  }

  const userIds = Object.keys(tally);
  if (userIds.length === 0) return NextResponse.json({ data: [], period });

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const ranked = userIds
    .map(uid => {
      const t = tally[uid];
      const decided = t.wins + t.losses;
      const winRate = decided > 0 ? Math.round((t.wins / decided) * 100) : 0;
      return {
        userId: uid,
        displayName: userMap[uid]?.displayName ?? "Unknown",
        avatarUrl: userMap[uid]?.avatarUrl ?? null,
        department: userMap[uid]?.department?.name ?? null,
        wins: t.wins,
        losses: t.losses,
        draws: t.draws,
        total: t.wins + t.losses + t.draws,
        winRate,
        isCurrentUser: uid === authUser.id,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.total - a.total)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return NextResponse.json({ data: ranked, period });
}
