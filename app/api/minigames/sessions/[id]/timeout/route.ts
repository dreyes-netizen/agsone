import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { gameLabel } from "@/lib/constants/gameLabels";
import { broadcastMany } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import {
  getChessTimeoutOutcome,
  type ChessRole,
  type ChessState,
} from "@/lib/minigames/chess";

/**
 * Settles a Chess game whose clock has run out.
 *
 * The request body is ignored entirely. A client posting here is only saying
 * "please look at the clock" — it never says who ran out or who won. The server
 * recomputes both from the persisted clock snapshot plus its own wall time, so
 * a doctored or simply stale client cannot flag an opponent who still has time.
 *
 * There is no scheduler behind this: a bank hitting zero is not itself an
 * event. Until somebody asks, the game is merely unsettled — which is harmless,
 * because `applyChessMove` independently refuses a move from a flagged player
 * (see the "Clock expired" throw), so nobody can play on past their own timeout
 * while waiting for this route to be called.
 */

const CONFLICT = "Game changed — please retry";
const NOT_EXPIRED = "Clock has not expired";

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

/** The subset of the row the settlement needs. */
type SessionRow = {
  id: string;
  hostId: string;
  guestId: string | null;
  pointsWager: number;
  state: unknown;
  updatedAt: Date;
};

type Settlement = { winnerId: string; loserId: string };

/**
 * Performs the whole settlement — ACTIVE -> FINISHED plus the payout — as one
 * transaction guarded on the exact row version `session` was read at.
 *
 * Returns `null` when the guard matched 0 rows, meaning some other write (a
 * move, a draw accept, or a racing timeout claim) landed first. In that case
 * the transaction has rolled back, so no points moved: the payout can only ever
 * ride on the single request that performed the status flip.
 *
 * The status flip and the `state` write happen in the SAME update on purpose.
 * The draw route's accept path relies on the invariant "status === ACTIVE
 * implies state.endReason === null"; writing a terminal `endReason` without
 * flipping the status — or vice versa — would break it and let a finished game
 * still look playable.
 */
async function settle(
  session: SessionRow,
  finalState: ChessState,
  { winnerId, loserId }: Settlement,
): Promise<true | null> {
  let conflicted = false;

  try {
    await prisma.$transaction(async (tx) => {
      const finish = await tx.gameSession.updateMany({
        where: { id: session.id, status: "ACTIVE", updatedAt: session.updatedAt },
        data: {
          status: "FINISHED",
          currentTurn: null,
          winnerId,
          state: JSON.parse(JSON.stringify(finalState)),
        },
      });

      if (finish.count !== 1) {
        throw new Error("TIMEOUT_CONFLICT");
      }

      if (session.pointsWager > 0) {
        // A decisive result pays the whole pot: the winner's own stake plus the
        // loser's. Both stakes were already debited when the game started.
        const prize = session.pointsWager * 2;

        await tx.user.update({
          where: { id: winnerId },
          data: { pointsBalance: { increment: prize } },
        });

        await tx.pointTransaction.create({
          data: {
            toUserId: winnerId,
            fromUserId: loserId,
            amount: prize,
            type: "GAME_WIN",
            createdById: winnerId,
          },
        });
      }
    });
  } catch (err: unknown) {
    if ((err as Error).message === "TIMEOUT_CONFLICT") {
      conflicted = true;
    } else {
      throw err;
    }
  }

  return conflicted ? null : true;
}

/** Builds the terminal state, with both clocks frozen at the reading that decided it. */
function buildFinalState(
  state: ChessState,
  outcome: NonNullable<ReturnType<typeof getChessTimeoutOutcome>>,
): ChessState {
  return {
    ...state,
    drawOfferBy: null,
    endReason: "timeout",
    winner: outcome.winner,
    // Stop the clock: `turnStartedAt: null` makes getChessClock return the
    // stored banks verbatim, and those banks are the ones we just judged — the
    // flagged side at 0, the winner at whatever they had left.
    turnStartedAt: null,
    whiteMs: outcome.whiteMs,
    blackMs: outcome.blackMs,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.gameType !== "CHESS") {
    return NextResponse.json({ error: "Timeouts are only available in Chess" }, { status: 400 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }

  const isHost = session.hostId === authUser.id;
  const isGuest = session.guestId === authUser.id;
  // Spectators can watch the clock hit zero too; they must not be able to end
  // the game or move somebody else's points.
  if (!isHost && !isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!session.guestId) return NextResponse.json({ error: "No opponent" }, { status: 400 });

  const myRole: ChessRole = isHost ? "host" : "guest";

  // Either player may claim the timeout — including the flagged player's own
  // client, which is often the first to notice. The winner is derived from the
  // clock, never from who asked.
  const winnerIdFor = (winner: ChessRole) =>
    winner === "host" ? session.hostId : session.guestId!;

  const outcome = getChessTimeoutOutcome(session.state as unknown as ChessState, new Date());
  if (!outcome) {
    return NextResponse.json({ error: NOT_EXPIRED }, { status: 409 });
  }

  let settled = await settle(
    session,
    buildFinalState(session.state as unknown as ChessState, outcome),
    {
      winnerId: winnerIdFor(outcome.winner),
      loserId: winnerIdFor(outcome.expired),
    },
  );

  let winnerId = winnerIdFor(outcome.winner);
  let loserId = winnerIdFor(outcome.expired);

  // --- lost the version race: refetch once and re-decide --------------------
  //
  // Unlike the draw route, a bare 409 here would be wrong. Our read may simply
  // be a few hundred milliseconds old, and what happened in between decides
  // whether this claim is still true:
  //
  //   * The game is already terminal — a finishing move, a draw accept, or a
  //     racing timeout claim beat us. Return that terminal row as-is. This is
  //     what makes the endpoint idempotent: the second claim pays nothing.
  //   * The game is still active but the row moved — almost always because the
  //     opponent's move landed. Recomputing against the FRESH state is the
  //     whole point: that move may have banked the mover's time and started the
  //     *other* clock, so "White timed out" computed a moment ago can now be
  //     plain false. Settling on the stale answer would end a live game.
  //
  // One retry only. If we lose the race twice the client can simply ask again.
  if (settled === null) {
    const fresh = await prisma.gameSession.findUnique({ where: { id } });
    if (!fresh) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (fresh.status !== "ACTIVE") {
      const current = await prisma.gameSession.findUnique({ where: { id }, select: selectFields });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: { ...current, myRole } });
    }
    if (!fresh.guestId) return NextResponse.json({ error: "No opponent" }, { status: 400 });

    const freshState = fresh.state as unknown as ChessState;
    // Fresh state, fresh wall time — nothing from the first attempt is reused.
    const freshOutcome = getChessTimeoutOutcome(freshState, new Date());
    if (!freshOutcome) {
      return NextResponse.json({ error: NOT_EXPIRED }, { status: 409 });
    }

    winnerId = freshOutcome.winner === "host" ? fresh.hostId : fresh.guestId;
    loserId = freshOutcome.expired === "host" ? fresh.hostId : fresh.guestId;

    settled = await settle(fresh, buildFinalState(freshState, freshOutcome), {
      winnerId,
      loserId,
    });

    if (settled === null) {
      return NextResponse.json({ error: CONFLICT }, { status: 409 });
    }
  }

  // Past this point we are the request that performed the transition, so the
  // notifications and broadcasts below fire exactly once per finished game.
  const updated = await prisma.gameSession.findUnique({ where: { id }, select: selectFields });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const label = gameLabel(session.gameType);

  await Promise.all([
    createNotification({
      userId: winnerId,
      type: "GAME_WIN",
      title: `${label} — You won on time! ⏱️`,
      body: session.pointsWager > 0 ? `+${session.pointsWager * 2} pts` : "Your opponent ran out of time.",
      data: { sessionId: id },
    }),
    createNotification({
      userId: loserId,
      type: "GAME_LOST",
      title: `${label} — Time expired`,
      body: "Your clock ran out. Better luck next time!",
      data: { sessionId: id },
    }),
  ]);

  // Same fan-out every other finishing path uses: the boards, the lobbies the
  // finished session must leave, and the points surfaces only when a wager
  // actually moved.
  await broadcastMany([
    { topic: `game:${id}` },
    { topic: "lobby" },
    { topic: realtimeTopics.minigameStats },
    { topic: realtimeTopics.adminAnalytics },
    ...(session.pointsWager > 0
      ? [
          { topic: realtimeTopics.profile(session.hostId) },
          { topic: realtimeTopics.profile(session.guestId) },
          { topic: realtimeTopics.pointsTransactions },
          { topic: realtimeTopics.leaderboard },
        ]
      : []),
  ]);

  return NextResponse.json({ data: { ...updated, myRole } });
}
