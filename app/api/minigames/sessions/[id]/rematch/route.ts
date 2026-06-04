import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { broadcast } from "@/lib/realtime/broadcast";
import { initState, type GameType } from "@/lib/minigames/initState";

const GAME_LABELS: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors",
  DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship",
  MEMORY: "Memory",
};

const sessionSelect = {
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
};

/**
 * Offer a rematch of a FINISHED game. Creates a fresh WAITING session hosted by
 * the requester (same game + wager), notifies the opponent, and pings the old
 * game channel so the opponent's finished screen surfaces an "Accept" button.
 * Consensual by design — the opponent must join (which spends their wager).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const old = await prisma.gameSession.findUnique({
    where: { id },
    include: { host: { select: { id: true, displayName: true } } },
  });
  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (old.status !== "FINISHED") return NextResponse.json({ error: "Game not finished" }, { status: 409 });

  const isHost = old.hostId === authUser.id;
  const isGuest = old.guestId === authUser.id;
  if (!isHost && !isGuest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!old.guestId) return NextResponse.json({ error: "No opponent to rematch" }, { status: 400 });

  const oldState = (old.state ?? {}) as Record<string, unknown>;

  // Idempotency: if a rematch was already offered for this game, return it.
  const existingId = oldState.rematchSessionId;
  if (typeof existingId === "string") {
    const existing = await prisma.gameSession.findUnique({ where: { id: existingId }, select: sessionSelect });
    if (existing && (existing.status === "WAITING" || existing.status === "ACTIVE")) {
      return NextResponse.json({ data: existing });
    }
  }

  const opponentId = isHost ? old.guestId : old.hostId;

  // Fresh session hosted by the requester.
  const created = await prisma.gameSession.create({
    data: {
      gameType: old.gameType,
      hostId: authUser.id,
      state: initState(old.gameType as GameType),
      pointsWager: old.pointsWager,
      currentTurn: null,
    },
    select: sessionSelect,
  });

  // Point the old session at the new one so the opponent's re-fetch can offer
  // it. rematchHostId lets the UI tell the initiator apart from the invitee.
  await prisma.gameSession.update({
    where: { id },
    data: { state: JSON.parse(JSON.stringify({ ...oldState, rematchSessionId: created.id, rematchHostId: authUser.id })) },
  });

  const label = GAME_LABELS[old.gameType] ?? "Minigame";
  const requesterName =
    (isHost ? old.host.displayName : null) ??
    (await prisma.user.findUnique({ where: { id: authUser.id }, select: { displayName: true } }))?.displayName ??
    "Someone";

  await createNotification({
    userId: opponentId,
    type: "GAME_INVITE",
    title: `${requesterName} wants a rematch!`,
    body: `${label}${old.pointsWager > 0 ? ` · ${old.pointsWager} pts wager` : ""}`,
    data: { sessionId: created.id },
  });

  // Wake the opponent's finished screen + refresh lobbies.
  await Promise.all([broadcast(`game:${id}`), broadcast("lobby")]);

  return NextResponse.json({ data: created }, { status: 201 });
}
