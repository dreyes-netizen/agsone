import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission || !mission.isActive) {
    return NextResponse.json({ error: "Mission not found or inactive" }, { status: 404 });
  }

  const existing = await prisma.missionCompletion.findUnique({
    where: { missionId_userId: { missionId: id, userId: authUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }

  const completion = await prisma.missionCompletion.create({
    data: { missionId: id, userId: authUser.id },
  });

  return NextResponse.json({ data: completion }, { status: 201 });
}
