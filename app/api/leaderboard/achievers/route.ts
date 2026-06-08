import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

const MILESTONE_LABELS: Record<string, string> = {
  BIRTHDAY: "Birthday",
  WORK_ANNIVERSARY_1: "1-Year Anniversary",
  WORK_ANNIVERSARY_3: "3-Year Anniversary",
  WORK_ANNIVERSARY_5: "5-Year Anniversary",
  WORK_ANNIVERSARY_10: "10-Year Anniversary",
};

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [badges, milestones] = await Promise.all([
    prisma.userBadge.findMany({
      where: { awardedAt: { gte: since } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        badge: { select: { name: true } },
      },
      orderBy: { awardedAt: "desc" },
      take: 20,
    }),
    prisma.milestoneAward.findMany({
      where: { awardedAt: { gte: since } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { awardedAt: "desc" },
      take: 20,
    }),
  ]);

  const combined = [
    ...badges.map((b) => ({
      userId: b.user.id,
      displayName: b.user.displayName,
      avatarUrl: b.user.avatarUrl,
      label: b.badge.name,
      achievedAt: b.awardedAt.toISOString(),
    })),
    ...milestones.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      label: MILESTONE_LABELS[m.type] ?? m.type,
      achievedAt: m.awardedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, 5);

  return NextResponse.json({ data: combined });
}
