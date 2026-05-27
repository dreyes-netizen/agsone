import { prisma } from "@/lib/prisma/client";
import { createNotification } from "./createNotification";

const STREAK_BONUS: Record<number, number> = {
  3: 50,
  7: 150,
  14: 300,
  30: 750,
};

export async function updateStreak(userId: string, lastActiveAt: Date | null, currentStreak: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!lastActiveAt) {
    await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now, streakDays: 1 } });
    return;
  }

  const last = new Date(lastActiveAt.getFullYear(), lastActiveAt.getMonth(), lastActiveAt.getDate());
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

  if (diffDays === 0) {
    await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now } });
    return;
  }

  if (diffDays === 1) {
    const newStreak = currentStreak + 1;
    await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now, streakDays: newStreak } });

    const bonus = STREAK_BONUS[newStreak];
    if (bonus) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { pointsBalance: { increment: bonus } } });
        await tx.pointTransaction.create({
          data: { toUserId: userId, amount: bonus, type: "ATTENDANCE", note: `${newStreak}-day login streak bonus!`, createdById: userId },
        });
      });
      await createNotification({
        userId,
        type: "STREAK_BONUS",
        title: `${newStreak}-day streak! 🔥`,
        body: `You earned ${bonus} bonus points for logging in ${newStreak} days in a row.`,
      });
    }
    return;
  }

  // Gap > 1 day — reset streak
  await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now, streakDays: 1 } });
}
