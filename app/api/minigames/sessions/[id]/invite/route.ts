import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { z } from "zod";

const schema = z.object({ userId: z.string().uuid() });

const GAME_LABELS: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors",
  DOTS_AND_BOXES: "Dots & Boxes",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const session = await prisma.gameSession.findUnique({
    where: { id },
    include: { host: { select: { displayName: true } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.hostId !== authUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.status !== "WAITING") return NextResponse.json({ error: "Game not open" }, { status: 409 });
  if (parsed.data.userId === authUser.id) return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });

  const label = GAME_LABELS[session.gameType] ?? "Minigame";

  await createNotification({
    userId: parsed.data.userId,
    type: "GAME_INVITE",
    title: `${session.host.displayName} challenged you!`,
    body: `Join their ${label} game${session.pointsWager > 0 ? ` · ${session.pointsWager} pts wager` : ""}`,
    data: { sessionId: id },
  });

  return NextResponse.json({ data: { ok: true } });
}
