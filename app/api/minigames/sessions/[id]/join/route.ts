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

  // Validate balances up front (read-only) so we can reject before touching the seat.
  if (session.pointsWager > 0) {
    const guest = await prisma.user.findUnique({ where: { id: authUser.id }, select: { pointsBalance: true } });
    if (!guest || guest.pointsBalance < session.pointsWager) {
      return NextResponse.json({ error: "Insufficient points for wager" }, { status: 400 });
    }
    if (session.host.pointsBalance < session.pointsWager) {
      return NextResponse.json({ error: "Host no longer has enough points" }, { status: 400 });
    }
  }

  // Seat-claim and wager debit happen in one atomic transaction: if either
  // debit fails (e.g. the host's balance was drained by a concurrent join on
  // a DIFFERENT session they're hosting — a single host can open several
  // WAITING sessions, so the up-front balance check above isn't sufficient
  // on its own), the whole thing rolls back, including the seat claim, so
  // the game stays WAITING instead of being stuck ACTIVE with no debit.
  let joinError: "SEAT_TAKEN" | "HOST_INSUFFICIENT" | "GUEST_INSUFFICIENT" | null = null;
  await prisma.$transaction(async (tx) => {
    const joinResult = await tx.gameSession.updateMany({
      where: { id, status: 'WAITING', guestId: null },
      data: { guestId: authUser.id, status: 'ACTIVE', currentTurn: session.hostId },
    });
    if (joinResult.count === 0) {
      joinError = "SEAT_TAKEN";
      return;
    }

    if (session.pointsWager > 0) {
      const hostDebit = await tx.user.updateMany({
        where: { id: session.hostId, pointsBalance: { gte: session.pointsWager } },
        data: { pointsBalance: { decrement: session.pointsWager } },
      });
      if (hostDebit.count === 0) {
        joinError = "HOST_INSUFFICIENT";
        return;
      }
      const guestDebit = await tx.user.updateMany({
        where: { id: authUser.id, pointsBalance: { gte: session.pointsWager } },
        data: { pointsBalance: { decrement: session.pointsWager } },
      });
      if (guestDebit.count === 0) {
        joinError = "GUEST_INSUFFICIENT";
        return;
      }
      await tx.pointTransaction.create({ data: { toUserId: session.hostId, fromUserId: session.hostId, amount: -session.pointsWager, type: "GAME_SPEND", createdById: session.hostId } });
      await tx.pointTransaction.create({ data: { toUserId: authUser.id, fromUserId: authUser.id, amount: -session.pointsWager, type: "GAME_SPEND", createdById: authUser.id } });
    }
  }, { isolationLevel: "Serializable" }).catch(() => {
    // joinError already set inside the callback for the expected cases; any
    // other error (e.g. a serialization conflict) should still surface.
    if (!joinError) throw new Error("JOIN_TRANSACTION_FAILED");
  });

  if (joinError === "SEAT_TAKEN") {
    return NextResponse.json({ error: 'Game no longer available' }, { status: 409 });
  }
  if (joinError === "HOST_INSUFFICIENT") {
    return NextResponse.json({ error: "Host no longer has enough points" }, { status: 400 });
  }
  if (joinError === "GUEST_INSUFFICIENT") {
    return NextResponse.json({ error: "Insufficient points for wager" }, { status: 400 });
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
