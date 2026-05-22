import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id, isActive: true } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const playsToday = await prisma.gamePlay.count({
    where: { gameId: id, userId: user.id, playedAt: { gte: todayStart } },
  });

  return NextResponse.json({
    data: { ...game, playsToday, canPlay: playsToday < game.dailyPlaysLimit },
  });
}
