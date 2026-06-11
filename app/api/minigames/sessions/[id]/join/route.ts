import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { broadcast } from "@/lib/realtime/broadcast";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const session = await prisma.gameSession.findUnique({
    where: { id },
    include: { host: { select: { pointsBalance: true } } },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.status !== "WAITING") return NextResponse.json({ error: "Game not open" }, { status: 409 });
  if (session.hostId === authUser.id) return NextResponse.json({ error: "Cannot join your own game" }, { status: 403 });

  if (session.pointsWager > 0) {
    const guest = await prisma.user.findUnique({ where: { id: authUser.id }, select: { pointsBalance: true } });
    if (!guest || guest.pointsBalance < session.pointsWager) {
      return NextResponse.json({ error: "Insufficient points for wager" }, { status: 400 });
    }
    if (session.host.pointsBalance < session.pointsWager) {
      return NextResponse.json({ error: "Host no longer has enough points" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: session.hostId }, data: { pointsBalance: { decrement: session.pointsWager } } }),
      prisma.user.update({ where: { id: authUser.id }, data: { pointsBalance: { decrement: session.pointsWager } } }),
      prisma.pointTransaction.create({ data: { toUserId: session.hostId, fromUserId: session.hostId, amount: -session.pointsWager, type: "GAME_SPEND", createdById: session.hostId } }),
      prisma.pointTransaction.create({ data: { toUserId: authUser.id, fromUserId: authUser.id, amount: -session.pointsWager, type: "GAME_SPEND", createdById: authUser.id } }),
    ]);
  }

  const joinResult = await prisma.gameSession.updateMany({
    where: { id, status: 'WAITING', guestId: null },
    data: { guestId: authUser.id, status: 'ACTIVE', currentTurn: session.hostId },
  });
  if (joinResult.count === 0) {
    return NextResponse.json({ error: 'Game no longer available' }, { status: 409 });
  }

  const updated = await prisma.gameSession.findUnique({
    where: { id },
    select: {
      id: true, gameType: true, status: true, state: true,
      currentTurn: true, winnerId: true, pointsWager: true,
      createdAt: true, updatedAt: true,
      host: { select: { id: true, displayName: true, avatarUrl: true } },
      guest: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  // Game is now active: wake the host's board, and drop it from open lobbies.
  await Promise.all([broadcast(`game:${id}`), broadcast("lobby")]);

  return NextResponse.json({ data: { ...updated, myRole: "guest" } });
}
