import { prisma } from "@/lib/prisma/client";
import { createNotification } from "./createNotification";
import { getLevelFromBalance } from "./levelUtils";

export { getLevelFromBalance, getLevelProgress } from "./levelUtils";

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
