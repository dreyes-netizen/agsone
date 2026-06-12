import { prisma } from "@/lib/prisma/client";
import { createNotification } from "./createNotification";

// Cumulative points required to reach each level (index 0 = level 1 threshold)
// Level 1: 0 pts | Level 2: 200 | Level 3: 500 | Level 4: 1000 | Level 5: 1750
// Level 6+: 2750 + (n-6) * 1000
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1750];
const LEVEL_6_BASE = 2750;
const LEVEL_6_STEP = 1000;

export function getLevelFromBalance(balance: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (balance >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelProgress(balance: number): { pointsIntoLevel: number; pointsNeededForLevel: number } {
  const level = getLevelFromBalance(balance);
  const currentThreshold = level <= LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[level - 1]
    : LEVEL_6_BASE + (level - 6) * LEVEL_6_STEP;
  const nextThreshold = level < LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[level]
    : LEVEL_6_BASE + (level - 5) * LEVEL_6_STEP;
  return {
    pointsIntoLevel: balance - currentThreshold,
    pointsNeededForLevel: nextThreshold - currentThreshold,
  };
}

export async function checkLevelUp(userId: string, newBalance: number) {
  const newLevel = getLevelFromBalance(newBalance);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { level: true, displayName: true } });
  if (!user || newLevel <= user.level) return;

  await prisma.user.update({ where: { id: userId }, data: { level: newLevel } });

  await Promise.all([
    createNotification({
      userId,
      type: "LEVEL_UP",
      title: `Level up! You're now Level ${newLevel} 🎉`,
      body: `Keep earning points to reach Level ${newLevel + 1}.`,
    }),
    prisma.socialPost.create({
      data: {
        authorId: userId,
        type: "ACHIEVEMENT",
        content: `🆙 ${user.displayName} just reached Level ${newLevel}! Congratulations! 🎉`,
      },
    }),
  ]);
}
