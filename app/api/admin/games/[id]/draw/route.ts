import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game || game.type !== "RAFFLE") return NextResponse.json({ error: "Not a raffle game" }, { status: 400 });

  const config = game.config as { prizePoints?: number };
  const prizePoints = config.prizePoints ?? 0;

  // Get all ticket holders
  const plays = await prisma.gamePlay.findMany({ where: { gameId: id } });
  if (plays.length === 0) return NextResponse.json({ error: "No participants" }, { status: 400 });

  const winnerPlay = plays[Math.floor(Math.random() * plays.length)];
  const winner = await prisma.user.findUnique({ where: { id: winnerPlay.userId }, select: { id: true, displayName: true, email: true, pointsBalance: true } });
  if (!winner) return NextResponse.json({ error: "Winner not found" }, { status: 500 });

  // Award prize
  await prisma.$transaction(async (tx) => {
    await tx.gamePlay.update({ where: { id: winnerPlay.id }, data: { pointsWon: prizePoints } });
    if (prizePoints > 0) {
      await tx.user.update({ where: { id: winner.id }, data: { pointsBalance: { increment: prizePoints } } });
      await tx.pointTransaction.create({
        data: { toUserId: winner.id, amount: prizePoints, type: "GAME_WIN", note: `Raffle winner: ${game.name}`, createdById: user!.id },
      });
    }
    await tx.game.update({ where: { id }, data: { isActive: false } });
  });

  // Announce on feed
  await prisma.socialPost.create({
    data: {
      authorId: user!.id,
      type: "CELEBRATION",
      content: `🎉 ${winner.displayName} won the "${game.name}" raffle${prizePoints > 0 ? ` and ${prizePoints.toLocaleString()} points` : ""}! Congratulations!`,
    },
  });

  // Notify winner
  await createNotification({
    userId: winner.id,
    type: "RAFFLE_WIN",
    title: `You won the ${game.name} raffle! 🎉`,
    body: prizePoints > 0 ? `${prizePoints.toLocaleString()} points have been added to your balance.` : "Contact HR to claim your prize.",
  });

  await sendMail({
    to: winner.email,
    subject: `You won the ${game.name} raffle! 🎉`,
    html: `<p>Congratulations ${winner.displayName}! You won the <strong>${game.name}</strong> raffle.${prizePoints > 0 ? ` <strong>${prizePoints.toLocaleString()} points</strong> have been added to your balance.` : " Please contact HR to claim your prize."}</p>`,
  });

  return NextResponse.json({ data: { winner: { id: winner.id, displayName: winner.displayName }, prizePoints } });
}
