import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completions = await prisma.missionCompletion.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      mission: { select: { id: true, title: true, pointsReward: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  return NextResponse.json({ data: completions });
}
