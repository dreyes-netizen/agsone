import { prisma } from "@/lib/prisma/client";
import { createNotification } from "./createNotification";

const BADGE_DEFS = [
  { name: "first-steps",   label: "First Steps",        description: "Received your first points",                   icon: "🌱" },
  { name: "century",       label: "Century Club",        description: "Accumulated 100+ points earned",               icon: "💯" },
  { name: "high-roller",   label: "High Roller",         description: "Accumulated 500+ points earned",               icon: "🎰" },
  { name: "points-pro",    label: "Points Pro",          description: "Accumulated 1,000+ points earned",             icon: "⭐" },
  { name: "elite-earner",  label: "Elite Earner",        description: "Accumulated 5,000+ points earned",             icon: "🏆" },
  { name: "legendary",     label: "Legend",              description: "Accumulated 10,000+ points earned",            icon: "👑" },
  { name: "redeemer",      label: "First Redemption",    description: "Made your first reward redemption",            icon: "🎁" },
  { name: "game-on",       label: "Game On",             description: "Played your first mini-game",                  icon: "🎮" },
  { name: "spin-master",   label: "Spin Master",         description: "Won 500+ points from a single spin",           icon: "🌀" },
  { name: "week-streak",   label: "On Fire",             description: "Logged in 7 days in a row",                    icon: "🔥" },
  { name: "month-streak",  label: "Unstoppable",         description: "Logged in 30 days in a row",                   icon: "⚡" },
] as const;

type BadgeName = (typeof BADGE_DEFS)[number]["name"];

type CheckContext = {
  userId: string;
  totalEarned?: number;
  redemptionCount?: number;
  gamePlaysCount?: number;
  biggestGameWin?: number;
  streakDays?: number;
};

export async function checkAndAwardBadges(ctx: CheckContext) {
  // Upsert badge definitions (idempotent)
  for (const def of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { name: def.label },
      update: {},
      create: { name: def.label, description: `${def.icon} ${def.description}`, criteriaType: "AUTO_RULE" },
    });
  }

  const badges = await prisma.badge.findMany({ where: { name: { in: BADGE_DEFS.map((d) => d.label) } } });
  const badgeMap = Object.fromEntries(badges.map((b) => [b.name, b]));

  const existing = await prisma.userBadge.findMany({
    where: { userId: ctx.userId },
    select: { badge: { select: { name: true } } },
  });
  const owned = new Set(existing.map((ub) => ub.badge.name));

  const toAward: BadgeName[] = [];

  const { totalEarned = 0, redemptionCount = 0, gamePlaysCount = 0, biggestGameWin = 0, streakDays = 0 } = ctx;

  if (totalEarned >= 1)      toAward.push("first-steps");
  if (totalEarned >= 100)    toAward.push("century");
  if (totalEarned >= 500)    toAward.push("high-roller");
  if (totalEarned >= 1000)   toAward.push("points-pro");
  if (totalEarned >= 5000)   toAward.push("elite-earner");
  if (totalEarned >= 10000)  toAward.push("legendary");
  if (redemptionCount >= 1)  toAward.push("redeemer");
  if (gamePlaysCount >= 1)   toAward.push("game-on");
  if (biggestGameWin >= 500) toAward.push("spin-master");
  if (streakDays >= 7)       toAward.push("week-streak");
  if (streakDays >= 30)      toAward.push("month-streak");

  for (const slug of toAward) {
    const def = BADGE_DEFS.find((d) => d.name === slug)!;
    const badge = badgeMap[def.label];
    if (!badge || owned.has(def.label)) continue;

    await prisma.userBadge.create({ data: { userId: ctx.userId, badgeId: badge.id } });
    await createNotification({
      userId: ctx.userId,
      type: "BADGE_EARNED",
      title: `Badge unlocked: ${def.icon} ${def.label}`,
      body: def.description,
    });
    owned.add(def.label);
  }
}
