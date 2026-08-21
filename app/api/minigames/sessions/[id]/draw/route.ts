import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { gameLabel } from "@/lib/constants/gameLabels";
import { broadcastMany } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import {
  declineChessDraw,
  offerChessDraw,
  type ChessRole,
  type ChessState,
} from "@/lib/minigames/chess";

/**
 * Only the verb is read off the request. The resulting state, the end reason
 * and the payout are all derived server-side from the persisted row — a client
 * cannot post `{ endReason: "draw_agreement" }` and settle its own wager.
 */
const drawSchema = z.object({
  action: z.enum(["offer", "accept", "decline"]),
});

const CONFLICT = "Game changed — please retry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = drawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const { action } = parsed.data;

  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.gameType !== "CHESS") {
    return NextResponse.json({ error: "Draws are only available in Chess" }, { status: 400 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }

  const isHost = session.hostId === authUser.id;
  const isGuest = session.guestId === authUser.id;
  // Spectators reach the board through the read route, so this is the only
  // thing standing between an onlooker and settling someone else's wager.
  if (!isHost && !isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role: ChessRole = isHost ? "host" : "guest";
  const state = session.state as unknown as ChessState;

  const selectFields = {
    id: true,
    gameType: true,
    status: true,
    state: true,
    settings: true,
    currentTurn: true,
    winnerId: true,
    pointsWager: true,
    createdAt: true,
    updatedAt: true,
    host: { select: { id: true, displayName: true, avatarUrl: true } },
    guest: { select: { id: true, displayName: true, avatarUrl: true } },
  } as const;

  // --- offer / decline: state-only, version-guarded ------------------------
  //
  // Both are a read-modify-write on `state`, and a draw is a two-request
  // negotiation: the offer and the answer can be seconds or minutes apart, so
  // there is a wide window for the opponent's move (which clears the offer) to
  // land in between. Gating on the exact `updatedAt` we read means a request
  // computed against a stale position matches 0 rows and is rejected, instead
  // of writing a whole stale `state` blob back over the newer one and undoing
  // their move.
  if (action === "offer" || action === "decline") {
    let nextState: ChessState;
    try {
      nextState =
        action === "offer"
          ? offerChessDraw(state, role)
          : declineChessDraw(state, role);
    } catch (err: unknown) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    const updatedRes = await prisma.gameSession.updateMany({
      where: { id, status: "ACTIVE", updatedAt: session.updatedAt },
      data: { state: JSON.parse(JSON.stringify(nextState)) },
    });

    if (updatedRes.count === 0) {
      return NextResponse.json({ error: CONFLICT }, { status: 409 });
    }

    const updated = await prisma.gameSession.findUnique({ where: { id }, select: selectFields });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // No persistent notification in V1: both players are on an active board and
    // Realtime repaints it. See the task-6 brief, step 7.
    await broadcastMany([{ topic: `game:${id}` }]);

    return NextResponse.json({ data: { ...updated, myRole: role } });
  }

  // --- accept: terminal, settles the wager ---------------------------------

  if (!state.drawOfferBy) {
    return NextResponse.json({ error: "No draw offer" }, { status: 400 });
  }
  if (state.drawOfferBy === role) {
    return NextResponse.json({ error: "Cannot accept your own draw offer" }, { status: 400 });
  }

  const finalState: ChessState = {
    ...state,
    drawOfferBy: null,
    endReason: "draw_agreement",
    winner: null,
    // Freeze both clocks: the game is over, so nobody's bank keeps burning.
    turnStartedAt: null,
  };

  // The ACTIVE -> FINISHED flip and both refunds are one transaction, and the
  // flip is guarded on `status` AND `updatedAt`. Two consequences:
  //
  //   * A racing duplicate accept (double-click, retried request) matches 0
  //     rows on the second attempt — `count !== 1` throws, the transaction
  //     rolls back, and nobody is refunded twice. The refund can only happen
  //     on the exact request that performed the transition.
  //   * A move that landed after our read also bumps `updatedAt`, so an accept
  //     computed against the pre-move position is rejected rather than
  //     finishing a game whose position has moved on (that move may itself
  //     have been checkmate).
  //
  // A refund is each player's OWN stake back — deliberately not the 2x pot a
  // decisive win pays, since neither side won.
  let conflicted = false;
  try {
    await prisma.$transaction(async (tx) => {
      const finish = await tx.gameSession.updateMany({
        where: { id, status: "ACTIVE", updatedAt: session.updatedAt },
        data: {
          status: "FINISHED",
          currentTurn: null,
          winnerId: null,
          state: JSON.parse(JSON.stringify(finalState)),
        },
      });

      if (finish.count !== 1) {
        throw new Error("DRAW_CONFLICT");
      }

      if (session.pointsWager > 0 && session.guestId) {
        await tx.user.update({
          where: { id: session.hostId },
          data: { pointsBalance: { increment: session.pointsWager } },
        });

        await tx.user.update({
          where: { id: session.guestId },
          data: { pointsBalance: { increment: session.pointsWager } },
        });

        await tx.pointTransaction.createMany({
          data: [
            {
              toUserId: session.hostId,
              fromUserId: session.hostId,
              amount: session.pointsWager,
              type: "GAME_WIN",
              createdById: session.hostId,
            },
            {
              toUserId: session.guestId,
              fromUserId: session.guestId,
              amount: session.pointsWager,
              type: "GAME_WIN",
              createdById: session.guestId,
            },
          ],
        });
      }
    });
  } catch (err: unknown) {
    if ((err as Error).message === "DRAW_CONFLICT") {
      conflicted = true;
    } else {
      throw err;
    }
  }

  if (conflicted) {
    return NextResponse.json({ error: CONFLICT }, { status: 409 });
  }

  const updated = await prisma.gameSession.findUnique({ where: { id }, select: selectFields });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const label = gameLabel(session.gameType);

  if (session.guestId) {
    await Promise.all([
      createNotification({
        userId: session.hostId,
        type: "GAME_DRAW",
        title: `${label} — Draw!`,
        body: "Draw agreed. Well played!",
        data: { sessionId: id },
      }),
      createNotification({
        userId: session.guestId,
        type: "GAME_DRAW",
        title: `${label} — Draw!`,
        body: "Draw agreed. Well played!",
        data: { sessionId: id },
      }),
    ]);
  }

  // Same fan-out the move route uses when a game finishes: the boards, the
  // lobbies the finished session must leave, and the points/profile surfaces
  // only when a wager actually moved.
  await broadcastMany([
    { topic: `game:${id}` },
    { topic: "lobby" },
    { topic: realtimeTopics.minigameStats },
    { topic: realtimeTopics.adminAnalytics },
    ...(session.pointsWager > 0
      ? [
          { topic: realtimeTopics.profile(session.hostId) },
          ...(session.guestId ? [{ topic: realtimeTopics.profile(session.guestId) }] : []),
          { topic: realtimeTopics.pointsTransactions },
          { topic: realtimeTopics.leaderboard },
        ]
      : []),
  ]);

  return NextResponse.json({ data: { ...updated, myRole: role } });
}
