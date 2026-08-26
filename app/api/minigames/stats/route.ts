import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import {
  getCurrentStreak,
  getHeadToHead,
  getMultiplayerRecord,
} from "@/lib/minigames/playerRecord";

type Outcome = "win" | "loss" | "draw";

const HISTORY_PAGE_SIZE = 20;

function outcomeFor(
  session: { winnerId: string | null },
  userId: string,
): Outcome {
  if (session.winnerId === null) return "draw";
  return session.winnerId === userId ? "win" : "loss";
}

// Value-based keyset cursor (updatedAt + id, the same pair the query orders
// by) rather than Prisma's built-in `cursor` option — that option requires
// the anchor row to still exist, and a value-based cursor keeps paging
// correctly even if the game session it pointed at gets deleted between
// pages.
function parseHistoryCursor(raw: string | null): { updatedAt: Date; id: string } | null {
  if (!raw) return null;
  const sepIndex = raw.indexOf(":");
  if (sepIndex === -1) return null;
  const ms = Number(raw.slice(0, sepIndex));
  const id = raw.slice(sepIndex + 1);
  if (!Number.isFinite(ms) || !id) return null;
  return { updatedAt: new Date(ms), id };
}

function encodeHistoryCursor(row: { updatedAt: Date; id: string }): string {
  return `${row.updatedAt.getTime()}:${row.id}`;
}

async function fetchHistoryPage(userId: string, cursorRaw: string | null) {
  const cursor = parseHistoryCursor(cursorRaw);

  const rows = await prisma.gameSession.findMany({
    where: {
      status: "FINISHED",
      AND: [
        { OR: [{ hostId: userId }, { guestId: userId }] },
        ...(cursor
          ? [
              {
                OR: [
                  { updatedAt: { lt: cursor.updatedAt } },
                  { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
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
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: HISTORY_PAGE_SIZE + 1,
  });

  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? encodeHistoryCursor(page[page.length - 1]) : null;

  const opponentIds = [
    ...new Set(
      page.map(s => (s.hostId === userId ? s.guestId : s.hostId)).filter(Boolean) as string[],
    ),
  ];
  const opponents = await prisma.user.findMany({
    where: { id: { in: opponentIds } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const oppMap = Object.fromEntries(opponents.map(u => [u.id, u]));

  const history = page.map(s => {
    const opponentId = s.hostId === userId ? s.guestId : s.hostId;
    const opp = opponentId ? oppMap[opponentId] : null;
    return {
      id: s.id,
      gameType: s.gameType,
      outcome: outcomeFor(s, userId),
      wager: s.pointsWager,
      opponentName: opp?.displayName ?? "Unknown",
      opponentAvatarUrl: opp?.avatarUrl ?? null,
      finishedAt: s.updatedAt,
    };
  });

  return { history, nextCursor };
}

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const opponentId = searchParams.get("opponentId");
  const cursor = searchParams.get("cursor");

  // Paging an already-loaded history list: return just the next page instead
  // of redoing the full wins/losses/streak/per-game aggregation the initial
  // load already returned.
  if (cursor) {
    const { history, nextCursor } = await fetchHistoryPage(authUser.id, cursor);
    return NextResponse.json({ data: { history, nextCursor } });
  }

  // Head-to-head mode: record vs one specific opponent — a grouped COUNT
  // instead of fetching every session played against them and tallying in
  // JS (a veteran pair of players could have hundreds of matches).
  if (opponentId) {
    return NextResponse.json({ data: await getHeadToHead(authUser.id, opponentId) });
  }

  // Personal stats — win/loss/draw totals, the per-game breakdown, the current
  // streak, and the first page of history. The aggregation lives in
  // lib/minigames/playerRecord so the player-record modal can run the same
  // queries for someone other than the caller.
  const [record, currentStreak, { history, nextCursor }] = await Promise.all([
    getMultiplayerRecord(authUser.id),
    getCurrentStreak(authUser.id),
    fetchHistoryPage(authUser.id, null),
  ]);

  return NextResponse.json({
    data: {
      ...record,
      currentStreak,
      history,
      historyCursor: nextCursor,
    },
  });
}
