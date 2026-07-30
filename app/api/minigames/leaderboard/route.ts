import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

/**
 * Minigames leaderboard — ranks players by wins across FINISHED games.
 *
 * Previously this fetched every FINISHED GameSession row (hostId, guestId,
 * winnerId) and tallied wins/losses/draws per player in JS — the comment
 * here used to say "fine at this scale," but that scales with total games
 * played forever, unbounded. A player appears as either the host OR the
 * guest depending on the row, so this can't be a plain Prisma `groupBy` on
 * one column; UNION ALL-ing the two roles into one "participant" view before
 * grouping gets the same tally computed inside Postgres instead of being
 * transferred row-by-row and summed here.
 */
export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "alltime";

  const monthStart =
    period === "monthly"
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      : null;

  const tallyRows = await prisma.$queryRaw<
    { userId: string; wins: bigint; losses: bigint; draws: bigint }[]
  >`
    WITH participants AS (
      SELECT "hostId" AS "userId", "winnerId" FROM "GameSession"
      WHERE status = 'FINISHED' AND "hostId" IS NOT NULL
        AND (${monthStart}::timestamp IS NULL OR "createdAt" >= ${monthStart}::timestamp)
      UNION ALL
      SELECT "guestId" AS "userId", "winnerId" FROM "GameSession"
      WHERE status = 'FINISHED' AND "guestId" IS NOT NULL
        AND (${monthStart}::timestamp IS NULL OR "createdAt" >= ${monthStart}::timestamp)
    )
    SELECT "userId",
      COUNT(*) FILTER (WHERE "winnerId" = "userId") AS wins,
      COUNT(*) FILTER (WHERE "winnerId" IS NULL) AS draws,
      COUNT(*) FILTER (WHERE "winnerId" IS NOT NULL AND "winnerId" != "userId") AS losses
    FROM participants
    GROUP BY "userId"
  `;

  if (tallyRows.length === 0) return NextResponse.json({ data: [], period });

  const ranked = tallyRows
    .map((row) => {
      const wins = Number(row.wins);
      const losses = Number(row.losses);
      const draws = Number(row.draws);
      const decided = wins + losses;
      const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;
      return { userId: row.userId, wins, losses, draws, total: wins + losses + draws, winRate };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.total - a.total)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Only resolve display info for the top 50 actually returned, same as before.
  const userIds = ranked.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const data = ranked.map((r) => ({
    userId: r.userId,
    displayName: userMap[r.userId]?.displayName ?? "Unknown",
    avatarUrl: userMap[r.userId]?.avatarUrl ?? null,
    department: userMap[r.userId]?.department?.name ?? null,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    total: r.total,
    winRate: r.winRate,
    isCurrentUser: r.userId === authUser.id,
    rank: r.rank,
  }));

  return NextResponse.json({ data, period });
}
