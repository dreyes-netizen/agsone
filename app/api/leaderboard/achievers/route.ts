import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  // Previously this also unioned in MilestoneAward rows (birthdays and work
  // anniversaries). That feature was removed — it never awarded anything in
  // production — so the second query was a guaranteed-empty round trip on a
  // route the leaderboard page calls on every load.
  const badges = await prisma.userBadge.findMany({
    where: { awardedAt: { gte: since } },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      badge: { select: { name: true } },
    },
    orderBy: { awardedAt: "desc" },
    take: 5,
  });

  const data = badges.map((b) => ({
    userId: b.user.id,
    displayName: b.user.displayName,
    avatarUrl: b.user.avatarUrl,
    label: b.badge.name,
    achievedAt: b.awardedAt.toISOString(),
  }));

  return NextResponse.json({ data });
}
