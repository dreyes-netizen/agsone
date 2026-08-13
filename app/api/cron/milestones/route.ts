import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { timingSafeCompare } from "@/lib/auth/timingSafeCompare";
import { broadcastMany } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const ANNIVERSARY_TYPES = {
  1:  "WORK_ANNIVERSARY_1",
  3:  "WORK_ANNIVERSARY_3",
  5:  "WORK_ANNIVERSARY_5",
  10: "WORK_ANNIVERSARY_10",
} as const;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 20 || secret === "change-this-to-a-random-secret") {
    return NextResponse.json({ error: "Cron secret not properly configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !timingSafeCompare(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayMonth = today.getMonth(); // 0-indexed (JS convention)
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const configs = await prisma.milestoneConfig.findMany({
    where: { isActive: true },
  });
  if (configs.length === 0) {
    return NextResponse.json({ data: { awarded: 0, reason: "no active configs" } });
  }
  const configMap = Object.fromEntries(configs.map((c) => [c.type, c]));

  // Match month/day in SQL instead of pulling every user with ANY birthday
  // or hireDate set and filtering in JS. EXTRACT(MONTH ...) is 1-indexed,
  // unlike JS's getMonth().
  const anniversaryUsers = await prisma.$queryRaw<
    { id: string; displayName: string; hireDate: Date }[]
  >`
    SELECT id, "displayName", "hireDate"
    FROM "User"
    WHERE "hireDate" IS NOT NULL
      AND EXTRACT(MONTH FROM "hireDate") = ${todayMonth + 1}
      AND EXTRACT(DAY FROM "hireDate") = ${todayDay}
  `;

  if (anniversaryUsers.length === 0) {
    return NextResponse.json({ data: { awarded: 0 } });
  }

  // Group today's anniversary users by which milestone type they hit (users
  // whose year count doesn't map to a configured milestone, or whose
  // milestone isn't active, are dropped here) — everyone in the same group
  // shares the same cfg.pointsReward, so each group's writes can be batched
  // together instead of one $transaction per user.
  type AnniversaryType = (typeof ANNIVERSARY_TYPES)[keyof typeof ANNIVERSARY_TYPES];
  type Group = { milestoneType: AnniversaryType; label: string; users: typeof anniversaryUsers };
  const groups = new Map<AnniversaryType, Group>();
  for (const user of anniversaryUsers) {
    const yearsWorked = todayYear - user.hireDate.getFullYear();
    const milestoneType = ANNIVERSARY_TYPES[yearsWorked as keyof typeof ANNIVERSARY_TYPES];
    if (!milestoneType || !configMap[milestoneType]) continue;
    const label = `${yearsWorked}-Year Work Anniversary`;
    const group = groups.get(milestoneType) ?? { milestoneType, label, users: [] };
    group.users.push(user);
    groups.set(milestoneType, group);
  }

  if (groups.size === 0) {
    return NextResponse.json({ data: { awarded: 0 } });
  }

  // One query for "who's already been awarded this year" across every
  // relevant type, instead of a milestoneAward.findUnique per user.
  const allUserIds = [...groups.values()].flatMap((g) => g.users.map((u) => u.id));
  const existingAwards = await prisma.milestoneAward.findMany({
    where: {
      userId: { in: allUserIds },
      type: { in: [...groups.keys()] },
      year: todayYear,
    },
    select: { userId: true, type: true },
  });
  const alreadyAwarded = new Set(existingAwards.map((a) => `${a.userId}:${a.type}`));

  let awarded = 0;
  const notifications: { userId: string; title: string; body: string }[] = [];

  for (const group of groups.values()) {
    const toAward = group.users.filter((u) => !alreadyAwarded.has(`${u.id}:${group.milestoneType}`));
    if (toAward.length === 0) continue;

    const cfg = configMap[group.milestoneType];
    const toAwardIds = toAward.map((u) => u.id);

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { id: { in: toAwardIds } },
        data: { pointsBalance: { increment: cfg.pointsReward } },
      }),
      prisma.pointTransaction.createMany({
        data: toAwardIds.map((userId) => ({
          toUserId: userId,
          amount: cfg.pointsReward,
          type: "MILESTONE",
          note: `Congratulations on your ${group.label}! You've earned ${cfg.pointsReward} pts.`,
          createdById: cfg.updatedById,
        })),
      }),
      prisma.milestoneAward.createMany({
        data: toAwardIds.map((userId) => ({ userId, type: group.milestoneType, year: todayYear })),
      }),
    ]);

    for (const _user of toAward) {
      notifications.push({
        userId: _user.id,
        title: `Happy ${group.label}!`,
        body: `You've received ${cfg.pointsReward} pts for your ${group.label}.`,
      });
    }
    awarded += toAward.length;
  }

  // None of these depend on each other — fire concurrently instead of one
  // notification at a time inside the award loop.
  await Promise.all(
    notifications.map((n) =>
      createNotification({ userId: n.userId, type: "MILESTONE", title: n.title, body: n.body })
    )
  );

  if (awarded > 0) {
    await broadcastMany([
      ...notifications.map((notification) => ({ topic: realtimeTopics.profile(notification.userId) })),
      { topic: realtimeTopics.pointsTransactions },
      { topic: realtimeTopics.leaderboard },
      { topic: realtimeTopics.adminAnalytics },
    ]);
  }

  return NextResponse.json({ data: { awarded } });
}
