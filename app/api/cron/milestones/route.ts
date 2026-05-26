import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";

const ANNIVERSARY_TYPES = {
  1:  "WORK_ANNIVERSARY_1",
  3:  "WORK_ANNIVERSARY_3",
  5:  "WORK_ANNIVERSARY_5",
  10: "WORK_ANNIVERSARY_10",
} as const;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const configs = await prisma.milestoneConfig.findMany({
    where: { isActive: true },
  });
  if (configs.length === 0) {
    return NextResponse.json({ data: { awarded: 0, reason: "no active configs" } });
  }

  const configMap = Object.fromEntries(configs.map((c) => [c.type, c]));

  const users = await prisma.user.findMany({
    where: {
      OR: [{ birthday: { not: null } }, { hireDate: { not: null } }],
    },
    select: { id: true, displayName: true, birthday: true, hireDate: true },
  });

  let awarded = 0;

  for (const user of users) {
    // Birthday
    if (user.birthday && configMap["BIRTHDAY"]) {
      const bMonth = user.birthday.getMonth();
      const bDay = user.birthday.getDate();
      if (bMonth === todayMonth && bDay === todayDay) {
        const existing = await prisma.milestoneAward.findUnique({
          where: { userId_type_year: { userId: user.id, type: "BIRTHDAY", year: todayYear } },
        });
        if (!existing) {
          const cfg = configMap["BIRTHDAY"];
          await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: cfg.pointsReward } } });
            await tx.pointTransaction.create({
              data: {
                toUserId: user.id,
                amount: cfg.pointsReward,
                type: "MILESTONE",
                note: `Happy Birthday! You've earned ${cfg.pointsReward} pts.`,
                createdById: cfg.updatedById,
              },
            });
            await tx.milestoneAward.create({ data: { userId: user.id, type: "BIRTHDAY", year: todayYear } });
          });
          await createNotification({
            userId: user.id,
            type: "MILESTONE",
            title: "Happy Birthday!",
            body: `You've received ${cfg.pointsReward} pts for your birthday!`,
          });
          awarded++;
        }
      }
    }

    // Work anniversaries
    if (user.hireDate) {
      const hMonth = user.hireDate.getMonth();
      const hDay = user.hireDate.getDate();
      if (hMonth === todayMonth && hDay === todayDay) {
        const yearsWorked = todayYear - user.hireDate.getFullYear();
        const milestoneType = ANNIVERSARY_TYPES[yearsWorked as keyof typeof ANNIVERSARY_TYPES];
        if (milestoneType && configMap[milestoneType]) {
          const existing = await prisma.milestoneAward.findUnique({
            where: { userId_type_year: { userId: user.id, type: milestoneType, year: todayYear } },
          });
          if (!existing) {
            const cfg = configMap[milestoneType];
            const label = `${yearsWorked}-Year Work Anniversary`;
            await prisma.$transaction(async (tx) => {
              await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: cfg.pointsReward } } });
              await tx.pointTransaction.create({
                data: {
                  toUserId: user.id,
                  amount: cfg.pointsReward,
                  type: "MILESTONE",
                  note: `Congratulations on your ${label}! You've earned ${cfg.pointsReward} pts.`,
                  createdById: cfg.updatedById,
                },
              });
              await tx.milestoneAward.create({ data: { userId: user.id, type: milestoneType, year: todayYear } });
            });
            await createNotification({
              userId: user.id,
              type: "MILESTONE",
              title: `Happy ${label}!`,
              body: `You've received ${cfg.pointsReward} pts for your ${label}.`,
            });
            awarded++;
          }
        }
      }
    }
  }

  return NextResponse.json({ data: { awarded } });
}
