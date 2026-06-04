import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { maskRPSState } from "@/lib/minigames/rps";
import { maskBSState } from "@/lib/minigames/battleship";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await prisma.gameSession.findUnique({ where: { id }, select: sessionSelect });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const myRole = session.host.id === authUser.id ? "host" : session.guest?.id === authUser.id ? "guest" : "spectator";

  let state = session.state as Record<string, unknown>;
  if (myRole !== "spectator") {
    const isHost = myRole === "host";
    if (session.gameType === "RPS") {
      state = maskRPSState(state as Parameters<typeof maskRPSState>[0], isHost) as Record<string, unknown>;
    }
    if (session.gameType === "BATTLESHIP") {
      state = maskBSState(state as Parameters<typeof maskBSState>[0], isHost) as Record<string, unknown>;
    }
  }

  return NextResponse.json({ data: { ...session, state, myRole } });
}
