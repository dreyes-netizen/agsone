import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

type Outcome = "win" | "loss" | "draw";

function outcomeFor(
  session: { winnerId: string | null },
  userId: string,
): Outcome {
  if (session.winnerId === null) return "draw";
  return session.winnerId === userId ? "win" : "loss";
}

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const opponentId = searchParams.get("opponentId");

  // Head-to-head mode: record vs one specific opponent — a grouped COUNT
  // instead of fetching every session played against them and tallying in
  // JS (a veteran pair of players could have hundreds of matches).
  if (opponentId) {
    const rows = await prisma.$queryRaw<{ wins: bigint; losses: bigint; draws: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "winnerId" = ${authUser.id}) AS wins,
        COUNT(*) FILTER (WHERE "winnerId" IS NULL) AS draws,
        COUNT(*) FILTER (WHERE "winnerId" IS NOT NULL AND "winnerId" != ${authUser.id}) AS losses
      FROM "GameSession"
      WHERE status = 'FINISHED'
        AND (("hostId" = ${authUser.id} AND "guestId" = ${opponentId})
          OR ("hostId" = ${opponentId} AND "guestId" = ${authUser.id}))
    `;
    const wins = Number(rows[0]?.wins ?? 0);
    const losses = Number(rows[0]?.losses ?? 0);
    const draws = Number(rows[0]?.draws ?? 0);
    return NextResponse.json({ data: { wins, losses, draws, total: wins + losses + draws } });
  }

  // Personal stats — win/loss/draw totals and the per-game breakdown used to
  // be computed by fetching EVERY finished game this user ever played (full
  // rows, 7 columns each) and tallying in JS. One GROUP BY gets both in a
  // single query, with only the 3 columns Postgres needs to do the counting.
  const perGameRows = await prisma.$queryRaw<
    { gameType: string; w: bigint; l: bigint; d: bigint }[]
  >`
    SELECT "gameType",
      COUNT(*) FILTER (WHERE "winnerId" = ${authUser.id}) AS w,
      COUNT(*) FILTER (WHERE "winnerId" IS NULL) AS d,
      COUNT(*) FILTER (WHERE "winnerId" IS NOT NULL AND "winnerId" != ${authUser.id}) AS l
    FROM "GameSession"
    WHERE status = 'FINISHED' AND ("hostId" = ${authUser.id} OR "guestId" = ${authUser.id})
    GROUP BY "gameType"
  `;

  let wins = 0, losses = 0, draws = 0;
  const perGame: Record<string, { w: number; l: number; d: number }> = {};
  for (const row of perGameRows) {
    const w = Number(row.w), l = Number(row.l), d = Number(row.d);
    perGame[row.gameType] = { w, l, d };
    wins += w;
    losses += l;
    draws += d;
  }

  // Current streak: count leading wins from the most recent game. Bounded to
  // the last 200 finished games (ordered desc, winnerId only) instead of
  // every game ever played — far more than any realistic streak, but a
  // fraction of the row/column weight of the original unbounded fetch.
  const recentOutcomes = await prisma.gameSession.findMany({
    where: { status: "FINISHED", OR: [{ hostId: authUser.id }, { guestId: authUser.id }] },
    select: { winnerId: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  let currentStreak = 0;
  for (const s of recentOutcomes) {
    if (s.winnerId === authUser.id) currentStreak++;
    else break;
  }

  // Recent history (last 20) — only these rows need the opponent-facing
  // fields (hostId/guestId/pointsWager), fetched directly with take: 20
  // instead of slicing an already-fully-loaded array.
  const recent = await prisma.gameSession.findMany({
    where: { status: "FINISHED", OR: [{ hostId: authUser.id }, { guestId: authUser.id }] },
    select: {
      id: true,
      gameType: true,
      hostId: true,
      guestId: true,
      winnerId: true,
      pointsWager: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const opponentIds = [
    ...new Set(
      recent.map(s => (s.hostId === authUser.id ? s.guestId : s.hostId)).filter(Boolean) as string[],
    ),
  ];
  const opponents = await prisma.user.findMany({
    where: { id: { in: opponentIds } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const oppMap = Object.fromEntries(opponents.map(u => [u.id, u]));

  const history = recent.map(s => {
    const opponentId = s.hostId === authUser.id ? s.guestId : s.hostId;
    const opp = opponentId ? oppMap[opponentId] : null;
    return {
      id: s.id,
      gameType: s.gameType,
      outcome: outcomeFor(s, authUser.id),
      wager: s.pointsWager,
      opponentName: opp?.displayName ?? "Unknown",
      opponentAvatarUrl: opp?.avatarUrl ?? null,
      finishedAt: s.updatedAt,
    };
  });

  const total = wins + losses + draws;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  return NextResponse.json({
    data: { wins, losses, draws, total, winRate, currentStreak, perGame, history },
  });
}
