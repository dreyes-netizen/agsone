import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { gameLabel } from "@/lib/constants/gameLabels";
import { broadcastMany } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { getChessClock, type ChessRole, type ChessState } from "@/lib/minigames/chess";

/**
 * Builds the terminal Chess state for a forfeit, with both clocks frozen at
 * the reading taken the instant the forfeit landed.
 *
 * Mirrors `timeout/route.ts`'s `buildFinalState`: `getChessClock` gives us
 * the CURRENT bank for both sides (accounting for whatever time the side to
 * move had already burned), not zero — a forfeit is not a timeout, so the
 * forfeiting side's clock should show what it actually had left, not "00:00".
 * `turnStartedAt: null` stops the clock from continuing to tick down on a
 * later page load; `endReason: "forfeit"` is what tells the board (and any
 * future viewer) this was a forfeit, not a timeout.
 */
function buildForfeitChessState(state: ChessState, winner: ChessRole): ChessState {
  const clock = getChessClock(state, new Date());
  return {
    ...state,
    drawOfferBy: null,
    endReason: "forfeit",
    winner,
    turnStartedAt: null,
    whiteMs: clock.whiteMs,
    blackMs: clock.blackMs,
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

  const isHost = session.hostId === authUser.id;
  const isGuest = session.guestId === authUser.id;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (session.status === "WAITING" && isHost) {
    await prisma.gameSession.update({ where: { id }, data: { status: "CANCELLED" } });
    // Cancelled challenge — drop it from open lobbies.
    await broadcastMany([{ topic: "lobby" }]);
    return NextResponse.json({ data: { status: "CANCELLED" } });
  }

  if (session.status !== "ACTIVE") return NextResponse.json({ error: "Game not active" }, { status: 409 });
  if (!session.guestId) return NextResponse.json({ error: "No opponent" }, { status: 400 });

  const winnerId = isHost ? session.guestId : session.hostId;

  // Chess carries a clock in `state`. Every other game type has nothing there
  // that needs freezing on forfeit, so only Chess gets a `state` write here —
  // adding a no-op `state` for the other 6 games would just be extra risk.
  const chessStateUpdate =
    session.gameType === "CHESS"
      ? {
          state: JSON.parse(
            JSON.stringify(
              buildForfeitChessState(
                session.state as unknown as ChessState,
                isHost ? "guest" : "host",
              ),
            ),
          ),
        }
      : {};

  // Atomically flip ACTIVE -> FINISHED. If count === 0 another request (a
  // finishing move, or a concurrent forfeit) already ended the game, so we
  // must NOT run the payout again — otherwise the pot is awarded twice.
  //
  // For Chess, the status flip and the terminal `state` write happen in this
  // SAME update on purpose — the same invariant the draw/timeout routes rely
  // on: "status === ACTIVE implies state.endReason === null" must transition
  // atomically, never as two separate writes.
  const finishRes = await prisma.gameSession.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "FINISHED", winnerId, currentTurn: null, ...chessStateUpdate },
  });
  if (finishRes.count === 0) {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }

  if (session.pointsWager > 0) {
    const prize = session.pointsWager * 2;
    await prisma.$transaction([
      prisma.user.update({ where: { id: winnerId }, data: { pointsBalance: { increment: prize } } }),
      prisma.pointTransaction.create({ data: { toUserId: winnerId, fromUserId: authUser.id, amount: prize, type: "GAME_WIN", createdById: authUser.id } }),
    ]);
  }

  const label = gameLabel(session.gameType);

  await Promise.all([
    createNotification({ userId: winnerId, type: "GAME_WIN", title: `${label} — Opponent forfeited!`, body: session.pointsWager > 0 ? `+${session.pointsWager * 2} pts awarded` : "You win!", data: { sessionId: id } }),
    // The forfeiter lost, so this is GAME_LOST. It used to be sent as GAME_WIN
    // with a "You forfeited" title — the type contradicted the message, which
    // made the outcome impossible to filter or toggle on.
    createNotification({ userId: authUser.id, type: "GAME_LOST", title: `${label} — You forfeited`, body: "Better luck next time.", data: { sessionId: id } }),
  ]);

  // Wake the opponent's board (game over) and refresh lobbies.
  await broadcastMany([
    { topic: `game:${id}` },
    { topic: "lobby" },
    { topic: realtimeTopics.minigameStats },
    { topic: realtimeTopics.adminAnalytics },
    ...(session.pointsWager > 0
      ? [
          { topic: realtimeTopics.profile(winnerId) },
          { topic: realtimeTopics.pointsTransactions },
          { topic: realtimeTopics.leaderboard },
        ]
      : []),
  ]);

  return NextResponse.json({ data: { status: "FINISHED", winnerId } });
}
