import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { broadcast } from "@/lib/realtime/broadcast";
import { initState, GAME_TYPES } from "@/lib/minigames/initState";

const createSchema = z.object({
  gameType: z.enum(GAME_TYPES),
  pointsWager: z.number().int().min(0).max(100).default(0),
});

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

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.gameSession.findMany({
    where: {
      OR: [
        { status: "WAITING", hostId: { not: authUser.id } },
        { hostId: authUser.id, status: { in: ["WAITING", "ACTIVE"] } },
        { guestId: authUser.id, status: { in: ["WAITING", "ACTIVE"] } },
      ],
    },
    select: sessionSelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: sessions });
}

export async function POST(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { gameType, pointsWager } = parsed.data;

  if (pointsWager > 0) {
    const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { pointsBalance: true } });
    if (!user || user.pointsBalance < pointsWager) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
    }
  }

  const session = await prisma.gameSession.create({
    data: {
      gameType,
      hostId: authUser.id,
      state: initState(gameType),
      pointsWager,
      currentTurn: null,
    },
    select: sessionSelect,
  });

  // New open challenge — refresh everyone's lobby.
  await broadcast("lobby");

  return NextResponse.json({ data: session }, { status: 201 });
}
