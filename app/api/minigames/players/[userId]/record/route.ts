import { after, type NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { getHeadToHead, getMultiplayerRecord } from "@/lib/minigames/playerRecord";
import { getSoloPersonalBests } from "@/lib/minigames/solo/personalBests";
import { getSoloSummary } from "@/lib/minigames/solo/leaderboard";
import {
  finalizePreviousWeekIfNeeded,
  getUserChampionships,
} from "@/lib/minigames/solo/champions";
import { getManilaRankKeys } from "@/lib/minigames/solo/time";
import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type { SoloGameType } from "@/lib/minigames/solo/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SOLO_GAME_TYPES = Object.keys(SOLO_GAME_REGISTRY) as SoloGameType[];

// SoloChampionRepository intentionally types its reads as `unknown[]` so tests
// can hand the service a minimal double. This is the shape the Prisma-backed
// implementation actually selects (see `championSelection` in champions.ts) —
// narrowed here rather than widening that seam for every existing caller.
type ChampionshipRow = {
  id: string;
  gameType: SoloGameType;
  scope: "COMPANY" | "DEPARTMENT";
  weekStart: Date;
  primaryScore: number;
  secondaryScore: number | null;
};

/**
 * The record card behind a leaderboard name — one player's multiplayer
 * per-game breakdown, their head-to-head record against the caller, and their
 * solo personal bests / weekly ranks / championships.
 *
 * Deliberately NOT a profile endpoint: it returns aggregates that the
 * leaderboards already publish and nothing more. Match history and point
 * wagers are excluded on purpose — an aggregate W/L is public, but *who*
 * somebody plays and what they staked is not. Those stay on
 * /api/minigames/stats, which only ever serves the caller their own data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const player = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      department: { select: { name: true } },
    },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  finalizeChampionsInBackground(new Date());

  const isSelf = player.id === authUser.id;

  // Personal bests resolve first because they tell us which solo games are
  // worth a rank lookup at all — an unplayed game has no rank to show, and
  // each rank costs its own windowed query.
  const [multiplayer, headToHead, personalBests, championships] = await Promise.all([
    getMultiplayerRecord(player.id),
    isSelf ? Promise.resolve(null) : getHeadToHead(authUser.id, player.id),
    getSoloPersonalBests(player.id),
    getUserChampionships(player.id),
  ]);

  const playedSoloGames = SOLO_GAME_TYPES.filter(
    (gameType) => personalBests[gameType] !== null,
  );
  const weekStart = dateOnly(getManilaRankKeys(new Date()).weekStart);
  const rankEntries = await Promise.all(
    playedSoloGames.map(async (gameType) => {
      const entry = await getSoloSummary({
        userId: player.id,
        gameType,
        period: "week",
        scope: "company",
        weekStart,
        departmentId: null,
      });
      return [gameType, entry?.rank ?? null] as const;
    }),
  );

  return NextResponse.json({
    data: {
      user: {
        id: player.id,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        department: player.department?.name ?? null,
      },
      isSelf,
      multiplayer,
      headToHead,
      solo: {
        personalBests,
        weekRanks: Object.fromEntries(rankEntries) as Partial<
          Record<SoloGameType, number | null>
        >,
        championships: (championships as ChampionshipRow[]).map((champion) => ({
          id: champion.id,
          gameType: champion.gameType,
          scope: champion.scope,
          weekStart: champion.weekStart,
          primaryScore: champion.primaryScore,
          secondaryScore: champion.secondaryScore,
        })),
      },
    },
  });
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

// Matches the lazy finalization the solo summary/leaderboard routes do: if this
// is the first solo read after a week closed, the championship list would
// otherwise be a week stale. Idempotent and safe to retry.
function finalizeChampionsInBackground(now: Date) {
  after(async () => {
    try {
      await finalizePreviousWeekIfNeeded(now);
    } catch (error) {
      console.error("[solo champion finalization]", error);
    }
  });
}
