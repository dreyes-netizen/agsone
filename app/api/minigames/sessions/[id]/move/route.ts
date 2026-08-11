import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { applyTTTMove, checkTTTResult } from "@/lib/minigames/tictactoe";
import { applyC4Move, checkC4Result } from "@/lib/minigames/connectfour";
import { applyRPSChoice, checkRPSResult, maskRPSState } from "@/lib/minigames/rps";
import { applyDnBMove, checkDnBResult } from "@/lib/minigames/dotsandboxes";
import { applyBSMove, checkBSResult, maskBSState, type BSState } from "@/lib/minigames/battleship";
import { applyMemoryMove, checkMemoryResult, maskMemoryState, type MemoryState } from "@/lib/minigames/memory";
import { createNotification } from "@/lib/helpers/createNotification";
import { broadcast } from "@/lib/realtime/broadcast";

function resolveWinnerId(result: unknown, session: { hostId: string; guestId: string | null }): string | null | "draw" {
  if (result === "draw") return "draw";
  if (result === "X" || result === 1 || result === "host") return session.hostId;
  if (result === "O" || result === 2 || result === "guest") return session.guestId ?? null;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  let session = await prisma.gameSession.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status !== "ACTIVE") return NextResponse.json({ error: "Game not active" }, { status: 409 });

  const isHost = session.hostId === authUser.id;
  const isGuest = session.guestId === authUser.id;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const selectFields = {
    id: true,
    gameType: true,
    status: true,
    state: true,
    currentTurn: true,
    winnerId: true,
    pointsWager: true,
    createdAt: true,
    updatedAt: true,
    host: { select: { id: true, displayName: true, avatarUrl: true } },
    guest: { select: { id: true, displayName: true, avatarUrl: true } },
  } as const;

  // Simultaneous-input phases (RPS picks, Battleship placement) mean two
  // requests can both read the same pre-move state before either write lands.
  // The non-finishing write below is gated on the exact `updatedAt` we read,
  // so a racing write that lands first makes ours a no-op (count === 0)
  // instead of clobbering it — we then re-fetch the now-current state,
  // recompute the move against it, and retry. applyRPSChoice/applyBSMove
  // only ever touch the acting player's own field and throw if that
  // player already acted, so replaying the computation against a fresher
  // read is always safe.
  const MAX_MOVE_RETRIES = 5;
  let newState: Record<string, unknown> = {};
  let nextTurn: string | null = session.currentTurn;
  let gameResult: unknown = null;
  let isFinished = false;
  let winnerId: string | null = null;
  let isDraw = false;
  let didFinish = false;
  let updated: Prisma.GameSessionGetPayload<{ select: typeof selectFields }> | null = null;

  for (let attempt = 0; ; attempt++) {
    const state = session.state as Record<string, unknown>;
    nextTurn = session.currentTurn;
    gameResult = null;

    try {
      switch (session.gameType) {
      case "TIC_TAC_TOE": {
        if (session.currentTurn !== authUser.id) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
        const { cellIndex } = body;
        newState = applyTTTMove(state as Parameters<typeof applyTTTMove>[0], cellIndex, isHost) as Record<string, unknown>;
        gameResult = checkTTTResult((newState as { board: ("X" | "O" | null)[] }).board);
        nextTurn = gameResult ? null : (isHost ? session.guestId : session.hostId);
        break;
      }
      case "CONNECT_FOUR": {
        if (session.currentTurn !== authUser.id) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
        const { column } = body;
        newState = applyC4Move(state as Parameters<typeof applyC4Move>[0], column, isHost) as Record<string, unknown>;
        gameResult = checkC4Result((newState as { board: (1 | 2 | null)[][] }).board);
        nextTurn = gameResult ? null : (isHost ? session.guestId : session.hostId);
        break;
      }
      case "RPS": {
        const { choice } = body;
        newState = applyRPSChoice(state as Parameters<typeof applyRPSChoice>[0], choice, isHost) as Record<string, unknown>;
        gameResult = checkRPSResult(newState as Parameters<typeof checkRPSResult>[0]);
        nextTurn = gameResult ? null : session.currentTurn;
        break;
      }
      case "DOTS_AND_BOXES": {
        if (session.currentTurn !== authUser.id) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
        const { lineType, row, col } = body;
        const playerNum = isHost ? 1 : 2;
        const { state: s, extraTurn } = applyDnBMove(state as Parameters<typeof applyDnBMove>[0], { lineType, row, col }, playerNum);
        newState = s as unknown as Record<string, unknown>;
        gameResult = checkDnBResult(s as Parameters<typeof checkDnBResult>[0]);
        nextTurn = gameResult ? null : (extraTurn ? authUser.id : (isHost ? session.guestId : session.hostId));
        break;
      }
      case "BATTLESHIP": {
        const { action, ships, cell } = body;
        if (action === "place") {
          // No turn check during placement — both players place simultaneously
          newState = applyBSMove(state as BSState, { action: "place", ships }, isHost) as Record<string, unknown>;
          const afterPlace = newState as BSState;
          // If both ready, battle starts with host going first
          nextTurn = afterPlace.phase === "battle" ? session.hostId : session.currentTurn;
          gameResult = checkBSResult(afterPlace);
        } else if (action === "shoot") {
          if (session.currentTurn !== authUser.id) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
          newState = applyBSMove(state as BSState, { action: "shoot", cell }, isHost) as Record<string, unknown>;
          gameResult = checkBSResult(newState as BSState);
          nextTurn = gameResult ? null : (isHost ? session.guestId : session.hostId);
        } else {
          return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }
        break;
      }
      case "MEMORY": {
        if (session.currentTurn !== authUser.id) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
        const { cardIndex, confirm } = body;
        const move = confirm ? ({ confirm: true } as const) : { cardIndex };
        const { state: ms, keepTurn } = applyMemoryMove(state as MemoryState, move, isHost);
        newState = ms as unknown as Record<string, unknown>;
        gameResult = checkMemoryResult(ms);
        nextTurn = gameResult ? null : (keepTurn ? authUser.id : (isHost ? session.guestId : session.hostId));
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown game type" }, { status: 400 });
      }
    } catch (err: unknown) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    isFinished = gameResult !== null;
    const rawWinnerId = isFinished ? resolveWinnerId(gameResult, { hostId: session.hostId, guestId: session.guestId }) : null;
    winnerId = rawWinnerId === "draw" ? null : rawWinnerId;
    isDraw = rawWinnerId === "draw";

    if (isFinished) {
      // `didFinish` is true only for the request that actually performs the
      // ACTIVE -> FINISHED transition. Guarding the wager payout on it (rather than
      // the locally-computed isFinished) makes the finish atomic and idempotent, so
      // two racing finishing-moves — or a move racing a forfeit — can't pay the pot
      // out twice. updateMany returns a count; only count === 1 performed the flip.
      const res = await prisma.gameSession.updateMany({
        where: { id, status: "ACTIVE" },
        data: {
          state: JSON.parse(JSON.stringify(newState)),
          currentTurn: null,
          status: "FINISHED",
          winnerId: winnerId ?? undefined,
        },
      });
      didFinish = res.count === 1;
      updated = await prisma.gameSession.findUnique({ where: { id }, select: selectFields });
      break;
    }

    // Gate the write on the exact row version we read (`updatedAt`, bumped
    // by Prisma's `@updatedAt` on every write, including the racing request's
    // write). If a concurrent simultaneous-input move (e.g. the other
    // player's RPS pick or Battleship placement) landed first, this matches
    // 0 rows instead of blindly overwriting it — count === 1 means our write
    // was the one applied on top of the exact state we read.
    const res = await prisma.gameSession.updateMany({
      where: { id, updatedAt: session.updatedAt },
      data: {
        state: JSON.parse(JSON.stringify(newState)),
        currentTurn: nextTurn,
      },
    });
    if (res.count === 1) {
      updated = await prisma.gameSession.findUnique({ where: { id }, select: selectFields });
      break;
    }

    // Lost the race: someone else's write landed between our read and our
    // write. Re-fetch the now-current row and recompute the move against it
    // on the next iteration instead of retrying with the stale `newState`.
    if (attempt >= MAX_MOVE_RETRIES - 1) {
      return NextResponse.json({ error: "Move conflicted with a concurrent update — please retry" }, { status: 409 });
    }
    const fresh = await prisma.gameSession.findUnique({ where: { id } });
    if (!fresh) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (fresh.status !== "ACTIVE") return NextResponse.json({ error: "Game not active" }, { status: 409 });
    session = fresh;
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (didFinish && session.pointsWager > 0 && session.guestId) {
    const prize = session.pointsWager * 2;
    if (isDraw) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: session.hostId }, data: { pointsBalance: { increment: session.pointsWager } } }),
        prisma.user.update({ where: { id: session.guestId }, data: { pointsBalance: { increment: session.pointsWager } } }),
        prisma.pointTransaction.create({ data: { toUserId: session.hostId, fromUserId: session.hostId, amount: session.pointsWager, type: "GAME_WIN", createdById: session.hostId } }),
        prisma.pointTransaction.create({ data: { toUserId: session.guestId, fromUserId: session.guestId, amount: session.pointsWager, type: "GAME_WIN", createdById: session.guestId } }),
      ]);
    } else if (winnerId) {
      const loserId = winnerId === session.hostId ? session.guestId : session.hostId;
      await prisma.$transaction([
        prisma.user.update({ where: { id: winnerId }, data: { pointsBalance: { increment: prize } } }),
        prisma.pointTransaction.create({ data: { toUserId: winnerId, fromUserId: loserId, amount: prize, type: "GAME_WIN", createdById: winnerId } }),
      ]);
    }
  }

  if (didFinish && session.guestId) {
    const opponentId = isHost ? session.guestId : session.hostId;
    const gameLabel: Record<string, string> = {
      TIC_TAC_TOE: "Tic-Tac-Toe", CONNECT_FOUR: "Connect Four",
      RPS: "Rock Paper Scissors", DOTS_AND_BOXES: "Dots & Boxes",
      BATTLESHIP: "Battleship", MEMORY: "Memory",
    };
    const label = gameLabel[session.gameType] ?? "Minigame";
    if (isDraw) {
      await Promise.all([
        createNotification({ userId: session.hostId, type: "GAME_WIN", title: `${label} — Draw!`, body: "It's a tie. Well played!", data: { sessionId: id } }),
        createNotification({ userId: session.guestId!, type: "GAME_WIN", title: `${label} — Draw!`, body: "It's a tie. Well played!", data: { sessionId: id } }),
      ]);
    } else if (winnerId) {
      await Promise.all([
        createNotification({ userId: winnerId, type: "GAME_WIN", title: `${label} — You won! 🎉`, body: session.pointsWager > 0 ? `+${session.pointsWager * 2} pts` : "Good game!", data: { sessionId: id } }),
        createNotification({ userId: opponentId, type: "GAME_WIN", title: `${label} — You lost`, body: "Better luck next time!", data: { sessionId: id } }),
      ]);
    }
  }

  let returnState = newState;
  if (session.gameType === "RPS") {
    returnState = maskRPSState(newState as Parameters<typeof maskRPSState>[0], isHost) as Record<string, unknown>;
  }
  if (session.gameType === "BATTLESHIP") {
    returnState = maskBSState(newState as BSState, isHost) as Record<string, unknown>;
  }
  if (session.gameType === "MEMORY") {
    returnState = maskMemoryState(newState as MemoryState, isHost) as Record<string, unknown>;
  }

  // Wake the opponent's board so the move shows instantly. When the game ends,
  // also refresh lobbies so the finished session leaves any open lists.
  await broadcast(`game:${id}`);
  if (isFinished) await broadcast("lobby");

  return NextResponse.json({ data: { ...updated, state: returnState, myRole: isHost ? "host" : "guest" } });
}
