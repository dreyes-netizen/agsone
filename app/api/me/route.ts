import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      role: true,
      pointsBalance: true,
      level: true,
      streakDays: true,
      onboardingComplete: true,
      birthday: true,
      hireDate: true,
      department: { select: { id: true, name: true } },
      userBadges: {
        orderBy: { awardedAt: "desc" },
        select: {
          id: true,
          awardedAt: true,
          badge: { select: { name: true, description: true } },
        },
      },
    },
  });

  return NextResponse.json({ data: profile });
}
