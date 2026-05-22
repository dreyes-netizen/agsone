import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const missions = await prisma.mission.findMany({
    where: { isActive: true },
    include: {
      completions: {
        where: { userId: authUser.id },
        select: { id: true, status: true, adminNote: true, completedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = missions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    pointsReward: m.pointsReward,
    type: m.type,
    startDate: m.startDate,
    endDate: m.endDate,
    myCompletion: m.completions[0] ?? null,
  }));

  return NextResponse.json({ data });
}
