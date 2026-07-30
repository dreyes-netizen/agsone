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
  const todayMonth = today.getMonth(); // 0-indexed (JS convention)
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const birthdayConfig = await prisma.milestoneConfig.findUnique({
    where: { type: "BIRTHDAY" },
  });
  const awardPoints = birthdayConfig?.isActive ? birthdayConfig.pointsReward : null;

  // Match month/day in SQL instead of pulling every active user with a
  // birthday and filtering in JS (that used to load the whole User table on
  // every run). EXTRACT(MONTH ...) is 1-indexed, unlike JS's getMonth().
  const birthdayUsers = await prisma.$queryRaw<
    { id: string; displayName: string; email: string }[]
  >`
    SELECT id, "displayName", email
    FROM "User"
    WHERE "isActive" = true
      AND birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = ${todayMonth + 1}
      AND EXTRACT(DAY FROM birthday) = ${todayDay}
  `;

  if (birthdayUsers.length === 0) {
    return NextResponse.json({ data: { processed: 0 } });
  }

  // One query for "who's already been awarded this year" instead of a
  // milestoneAward.findUnique per user inside a loop.
  const existingAwards = await prisma.milestoneAward.findMany({
    where: { userId: { in: birthdayUsers.map((u) => u.id) }, type: "BIRTHDAY", year: todayYear },
    select: { userId: true },
  });
  const alreadyAwarded = new Set(existingAwards.map((a) => a.userId));
  const toAward = birthdayUsers.filter((u) => !alreadyAwarded.has(u.id));

  if (toAward.length === 0) {
    return NextResponse.json({ data: { processed: 0 } });
  }

  const toAwardIds = toAward.map((u) => u.id);

  // Every birthday user this run gets the SAME awardPoints value, so the
  // balance increment, transaction rows, and award rows can all be batched
  // instead of one $transaction per user.
  if (awardPoints && birthdayConfig) {
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { id: { in: toAwardIds } },
        data: { pointsBalance: { increment: awardPoints } },
      }),
      prisma.pointTransaction.createMany({
        data: toAwardIds.map((userId) => ({
          toUserId: userId,
          amount: awardPoints,
          type: "MILESTONE",
          note: `Happy Birthday! 🎂 You've earned ${awardPoints} pts.`,
          createdById: birthdayConfig.updatedById,
        })),
      }),
      prisma.milestoneAward.createMany({
        data: toAwardIds.map((userId) => ({ userId, type: "BIRTHDAY", year: todayYear })),
      }),
    ]);
  } else {
    await prisma.milestoneAward.createMany({
      data: toAwardIds.map((userId) => ({ userId, type: "BIRTHDAY", year: todayYear })),
    });
  }

  const notifBody = awardPoints
    ? `You've received ${awardPoints} birthday points! Have a wonderful day! 🎂`
    : "Wishing you a wonderful birthday from everyone at AGS One! 🎂";

  // Per-user notification + email content differs (name), but none of these
  // depend on each other — fire them all concurrently instead of one user
  // at a time in a for-loop.
  await Promise.all(
    toAward.map((user) =>
      Promise.all([
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
      ])
    )
  );

  return NextResponse.json({ data: { processed: toAward.length } });
}
