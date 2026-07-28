// Runs daily at midnight via Vercel cron (see vercel.json).
// Awards birthday milestone points, sends notification + email.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { birthdayEmail } from "@/lib/email/templates";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 20 || secret === "change-this-to-a-random-secret") {
    return NextResponse.json({ error: "Cron secret not properly configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const birthdayConfig = await prisma.milestoneConfig.findUnique({
    where: { type: "BIRTHDAY" },
  });
  const awardPoints = birthdayConfig?.isActive ? birthdayConfig.pointsReward : null;

  const users = await prisma.user.findMany({
    where: { birthday: { not: null }, isActive: true },
    select: { id: true, displayName: true, email: true, birthday: true },
  });

  const birthdayUsers = users.filter(
    (u) => u.birthday!.getMonth() === todayMonth && u.birthday!.getDate() === todayDay
  );

  let processed = 0;

  for (const user of birthdayUsers) {
    const existing = await prisma.milestoneAward.findUnique({
      where: { userId_type_year: { userId: user.id, type: "BIRTHDAY", year: todayYear } },
    });
    if (existing) continue;

    if (awardPoints && birthdayConfig) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { pointsBalance: { increment: awardPoints } } });
        await tx.pointTransaction.create({
          data: {
            toUserId: user.id,
            amount: awardPoints,
            type: "MILESTONE",
            note: `Happy Birthday! 🎂 You've earned ${awardPoints} pts.`,
            createdById: birthdayConfig.updatedById,
          },
        });
        await tx.milestoneAward.create({ data: { userId: user.id, type: "BIRTHDAY", year: todayYear } });
      });
    } else {
      await prisma.milestoneAward.create({ data: { userId: user.id, type: "BIRTHDAY", year: todayYear } });
    }

    const notifBody = awardPoints
      ? `You've received ${awardPoints} birthday points! Have a wonderful day! 🎂`
      : "Wishing you a wonderful birthday from everyone at AGS One! 🎂";

    await Promise.all([
      createNotification({
        userId: user.id,
        type: "MILESTONE_REWARD",
        title: "Happy Birthday! 🎂",
        body: notifBody,
      }),
      sendMail({
        to: user.email,
        ...birthdayEmail(user.displayName, awardPoints),
      }).catch(() => {}),
    ]);

    processed++;
  }

  return NextResponse.json({ data: { processed } });
}
