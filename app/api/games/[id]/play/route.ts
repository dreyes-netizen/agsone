import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { weightedRandom, WeightedSegment } from "@/lib/helpers/weightedRandom";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { createNotification } from "@/lib/helpers/createNotification";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const game = await prisma.game.findUnique({ where: { id, isActive: true } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  // Check daily plays limit
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const playsToday = await prisma.gamePlay.count({
    where: { gameId: id, userId: user.id, playedAt: { gte: todayStart } },
  });
  if (playsToday >= game.dailyPlaysLimit) {
    return NextResponse.json({ error: "Daily play limit reached" }, { status: 400 });
  }

  // Check balance
  if (user.pointsBalance < game.entryCostPoints) {
    return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
  }

  // Handle by game type
  if (game.type === "SPIN_WHEEL") {
    const config = game.config as { segments: WeightedSegment[] };
    const { segment, index } = weightedRandom(config.segments);
    const pointsWon = segment.pointsReward;

    const play = await prisma.$transaction(async (tx) => {
      // Deduct entry cost
      if (game.entryCostPoints > 0) {
        await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { decrement: game.entryCostPoints } } });
        await tx.pointTransaction.create({
          data: { toUserId: user.id, amount: -game.entryCostPoints, type: "GAME_SPEND", note: `Spin: ${game.name}`, createdById: user.id },
        });
      }
      // Award winnings
      if (pointsWon > 0) {
        await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: pointsWon } } });
        await tx.pointTransaction.create({
          data: { toUserId: user.id, amount: pointsWon, type: "GAME_WIN", note: `Won: ${segment.label} on ${game.name}`, createdById: user.id },
        });
      }
      return tx.gamePlay.create({
        data: { gameId: id, userId: user.id, pointsSpent: game.entryCostPoints, outcome: { segmentIndex: index, label: segment.label }, pointsWon },
      });
    });

    // Badges + notification (fire-and-forget)
    const [totalEarned, gamePlaysCount] = await Promise.all([
      prisma.pointTransaction.aggregate({ where: { toUserId: user.id, amount: { gt: 0 } }, _sum: { amount: true } }),
      prisma.gamePlay.count({ where: { userId: user.id } }),
    ]);
    checkAndAwardBadges({
      userId: user.id,
      totalEarned: totalEarned._sum.amount ?? 0,
      gamePlaysCount,
      biggestGameWin: pointsWon,
    }).catch(() => {});

    if (pointsWon > 0) {
      createNotification({ userId: user.id, type: "GAME_WIN", title: `You won ${pointsWon} pts! 🎉`, body: `${segment.label} on ${game.name}` }).catch(() => {});
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
    if (pointsWon > 0 && updatedUser) {
      checkLevelUp(user.id, updatedUser.pointsBalance).catch(() => {});
    }

    return NextResponse.json({ data: { play, segmentIndex: index, pointsWon, newBalance: updatedUser?.pointsBalance ?? 0 } });
  }

  if (game.type === "RAFFLE") {
    // Buying a raffle ticket
    const ticketCount = await prisma.gamePlay.count({ where: { gameId: id, userId: user.id } });
    const ticketNumber = ticketCount + 1;

    const play = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { decrement: game.entryCostPoints } } });
      await tx.pointTransaction.create({
        data: { toUserId: user.id, amount: -game.entryCostPoints, type: "GAME_SPEND", note: `Raffle ticket #${ticketNumber}: ${game.name}`, createdById: user.id },
      });
      return tx.gamePlay.create({
        data: { gameId: id, userId: user.id, pointsSpent: game.entryCostPoints, outcome: { ticketNumber }, pointsWon: 0 },
      });
    });

    const [gamePlaysCount] = await Promise.all([
      prisma.gamePlay.count({ where: { userId: user.id } }),
    ]);
    checkAndAwardBadges({ userId: user.id, gamePlaysCount }).catch(() => {});

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
    return NextResponse.json({ data: { play, ticketNumber, newBalance: updatedUser?.pointsBalance ?? 0 } });
  }

  if (game.type === "QUIZ") {
    const config = game.config as { questions: { id: string; question: string; options: string[]; correctIndex: number; pointsReward: number }[]; timePerQuestion: number };
    const body = await req.json() as { answers: number[] };
    const { answers } = body;

    if (!Array.isArray(answers) || answers.length !== config.questions.length) {
      return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
    }

    const correctAnswers = config.questions.map((q) => q.correctIndex);
    let pointsWon = 0;
    answers.forEach((answer, i) => {
      if (answer === config.questions[i].correctIndex) {
        pointsWon += config.questions[i].pointsReward;
      }
    });
    const score = answers.filter((a, i) => a === config.questions[i].correctIndex).length;
    const total = config.questions.length;

    const play = await prisma.$transaction(async (tx) => {
      if (game.entryCostPoints > 0) {
        await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { decrement: game.entryCostPoints } } });
        await tx.pointTransaction.create({
          data: { toUserId: user.id, amount: -game.entryCostPoints, type: "GAME_SPEND", note: `Quiz: ${game.name}`, createdById: user.id },
        });
      }
      if (pointsWon > 0) {
        await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: pointsWon } } });
        await tx.pointTransaction.create({
          data: { toUserId: user.id, amount: pointsWon, type: "GAME_WIN", note: `Quiz score ${score}/${total} on ${game.name}`, createdById: user.id },
        });
      }
      return tx.gamePlay.create({
        data: { gameId: id, userId: user.id, pointsSpent: game.entryCostPoints, outcome: { answers, correctAnswers, score, total }, pointsWon },
      });
    });

    const [totalEarned, gamePlaysCount] = await Promise.all([
      prisma.pointTransaction.aggregate({ where: { toUserId: user.id, amount: { gt: 0 } }, _sum: { amount: true } }),
      prisma.gamePlay.count({ where: { userId: user.id } }),
    ]);
    checkAndAwardBadges({
      userId: user.id,
      totalEarned: totalEarned._sum.amount ?? 0,
      gamePlaysCount,
      biggestGameWin: pointsWon,
    }).catch(() => {});

    if (pointsWon > 0) {
      createNotification({ userId: user.id, type: "GAME_WIN", title: `Quiz: ${score}/${total} correct — ${pointsWon} pts won!`, body: game.name }).catch(() => {});
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
    if (pointsWon > 0 && updatedUser) {
      checkLevelUp(user.id, updatedUser.pointsBalance).catch(() => {});
    }

    return NextResponse.json({ data: { play, score, total, pointsWon, newBalance: updatedUser?.pointsBalance ?? 0 } });
  }

  return NextResponse.json({ error: "Unsupported game type" }, { status: 400 });
}
