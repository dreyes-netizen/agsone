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

  // Head-to-head mode: record vs one specific opponent.
  if (opponentId) {
    const sessions = await prisma.gameSession.findMany({
      where: {
        status: "FINISHED",
        OR: [
          { hostId: authUser.id, guestId: opponentId },
          { hostId: opponentId, guestId: authUser.id },
        ],
      },
      select: { winnerId: true },
    });

    let wins = 0, losses = 0, draws = 0;
    for (const s of sessions) {
      const o = outcomeFor(s, authUser.id);
      if (o === "win") wins++;
      else if (o === "loss") losses++;
      else draws++;
    }
    return NextResponse.json({ data: { wins, losses, draws, total: sessions.length } });
  }

  // Personal stats: every finished game this user played, newest first.
  const sessions = await prisma.gameSession.findMany({
    where: {
      status: "FINISHED",
      OR: [{ hostId: authUser.id }, { guestId: authUser.id }],
    },
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
  });

  let wins = 0, losses = 0, draws = 0;
  const perGame: Record<string, { w: number; l: number; d: number }> = {};

  for (const s of sessions) {
    const o = outcomeFor(s, authUser.id);
    if (o === "win") wins++;
    else if (o === "loss") losses++;
    else draws++;

    const g = (perGame[s.gameType] ??= { w: 0, l: 0, d: 0 });
    if (o === "win") g.w++;
    else if (o === "loss") g.l++;
    else g.d++;
  }

  // Current streak: count leading wins from the most recent game.
  let currentStreak = 0;
  for (const s of sessions) {
    if (outcomeFor(s, authUser.id) === "win") currentStreak++;
    else break;
  }

  // Recent history (last 20) — resolve opponent display names.
  const recent = sessions.slice(0, 20);
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

  const total = sessions.length;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  return NextResponse.json({
    data: { wins, losses, draws, total, winRate, currentStreak, perGame, history },
  });
}
