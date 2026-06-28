import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { broadcast } from "@/lib/realtime/broadcast";

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
    await broadcast("lobby");
    return NextResponse.json({ data: { status: "CANCELLED" } });
  }

  if (session.status !== "ACTIVE") return NextResponse.json({ error: "Game not active" }, { status: 409 });
  if (!session.guestId) return NextResponse.json({ error: "No opponent" }, { status: 400 });

  const winnerId = isHost ? session.guestId : session.hostId;

  // Atomically flip ACTIVE -> FINISHED. If count === 0 another request (a
  // finishing move, or a concurrent forfeit) already ended the game, so we
  // must NOT run the payout again — otherwise the pot is awarded twice.
  const finishRes = await prisma.gameSession.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "FINISHED", winnerId, currentTurn: null },
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

  const gameLabel: Record<string, string> = {
    TIC_TAC_TOE: "Tic-Tac-Toe", CONNECT_FOUR: "Connect Four",
    RPS: "Rock Paper Scissors", DOTS_AND_BOXES: "Dots & Boxes",
  };
  const label = gameLabel[session.gameType] ?? "Minigame";

  await Promise.all([
    createNotification({ userId: winnerId, type: "GAME_WIN", title: `${label} — Opponent forfeited!`, body: session.pointsWager > 0 ? `+${session.pointsWager * 2} pts awarded` : "You win!", data: { sessionId: id } }),
    createNotification({ userId: authUser.id, type: "GAME_WIN", title: `${label} — You forfeited`, body: "Better luck next time.", data: { sessionId: id } }),
  ]);

  // Wake the opponent's board (game over) and refresh lobbies.
  await Promise.all([broadcast(`game:${id}`), broadcast("lobby")]);

  return NextResponse.json({ data: { status: "FINISHED", winnerId } });
}
