import { prisma } from "@/lib/prisma/client";

/**
 * Multiplayer win/loss aggregation for an arbitrary player.
 *
 * This used to live inline in `app/api/minigames/stats/route.ts` hardcoded to
 * the authenticated user. It is extracted here so the player-record modal can
 * run the same aggregation for someone else without duplicating the SQL.
 *
 * The counting stays in Postgres (`COUNT(*) FILTER`) rather than fetching every
 * finished session and tallying in JS — a veteran player can have hundreds.
 */

export type PerGameRecord = { w: number; l: number; d: number };

export type MultiplayerRecord = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
  perGame: Record<string, PerGameRecord>;
};

export type HeadToHeadRecord = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
};

/** Raw counts come back from Postgres as `bigint`, hence the union. */
type CountLike = bigint | number;

export type PerGameRow = {
  gameType: string;
  w: CountLike;
  l: CountLike;
  d: CountLike;
};

export type HeadToHeadRow = {
  wins: CountLike;
  losses: CountLike;
  draws: CountLike;
};

/**
 * Win rate deliberately excludes draws from the denominator — a drawn game
 * neither helps nor hurts. Guarded against 0/0 so a player with only draws (or
 * no games at all) reports 0%, not NaN.
 */
export function winRateOf(wins: number, losses: number): number {
  const decided = wins + losses;
  return decided > 0 ? Math.round((wins / decided) * 100) : 0;
}

/** Pure mapping step, split out so it can be unit-tested without a database. */
export function toMultiplayerRecord(rows: PerGameRow[]): MultiplayerRecord {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const perGame: Record<string, PerGameRecord> = {};

  for (const row of rows) {
    const w = Number(row.w);
    const l = Number(row.l);
    const d = Number(row.d);
    perGame[row.gameType] = { w, l, d };
    wins += w;
    losses += l;
    draws += d;
  }

  return {
    wins,
    losses,
    draws,
    total: wins + losses + draws,
    winRate: winRateOf(wins, losses),
    perGame,
  };
}

/** Pure mapping step for the head-to-head query. */
export function toHeadToHeadRecord(rows: HeadToHeadRow[]): HeadToHeadRecord {
  const wins = Number(rows[0]?.wins ?? 0);
  const losses = Number(rows[0]?.losses ?? 0);
  const draws = Number(rows[0]?.draws ?? 0);
  return { wins, losses, draws, total: wins + losses + draws };
}

export async function getMultiplayerRecord(userId: string): Promise<MultiplayerRecord> {
  const rows = await prisma.$queryRaw<PerGameRow[]>`
    SELECT "gameType",
      COUNT(*) FILTER (WHERE "winnerId" = ${userId}) AS w,
      COUNT(*) FILTER (WHERE "winnerId" IS NULL) AS d,
      COUNT(*) FILTER (WHERE "winnerId" IS NOT NULL AND "winnerId" != ${userId}) AS l
    FROM "GameSession"
    WHERE status = 'FINISHED' AND ("hostId" = ${userId} OR "guestId" = ${userId})
    GROUP BY "gameType"
  `;
  return toMultiplayerRecord(rows);
}

export async function getHeadToHead(
  userId: string,
  opponentId: string,
): Promise<HeadToHeadRecord> {
  const rows = await prisma.$queryRaw<HeadToHeadRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE "winnerId" = ${userId}) AS wins,
      COUNT(*) FILTER (WHERE "winnerId" IS NULL) AS draws,
      COUNT(*) FILTER (WHERE "winnerId" IS NOT NULL AND "winnerId" != ${userId}) AS losses
    FROM "GameSession"
    WHERE status = 'FINISHED'
      AND (("hostId" = ${userId} AND "guestId" = ${opponentId})
        OR ("hostId" = ${opponentId} AND "guestId" = ${userId}))
  `;
  return toHeadToHeadRecord(rows);
}

/**
 * Leading wins from the most recent finished game. Bounded to the last 200
 * sessions — far more than any realistic streak, but a fraction of the row
 * weight of scanning a full match history.
 */
export async function getCurrentStreak(userId: string): Promise<number> {
  const recentOutcomes = await prisma.gameSession.findMany({
    where: { status: "FINISHED", OR: [{ hostId: userId }, { guestId: userId }] },
    select: { winnerId: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  let streak = 0;
  for (const session of recentOutcomes) {
    if (session.winnerId === userId) streak++;
    else break;
  }
  return streak;
}
