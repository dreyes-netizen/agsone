import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  pointsReward: z.number().int().min(1),
  type: z.enum(["INDIVIDUAL", "TEAM"]).default("INDIVIDUAL"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const missions = await prisma.mission.findMany({
    include: { _count: { select: { completions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: missions });
}

export async function POST(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, pointsReward, type, startDate, endDate } = parsed.data;

  const mission = await prisma.mission.create({
    data: {
      title,
      description: description ?? null,
      pointsReward,
      type,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdById: authUser!.id,
    },
  });

  return NextResponse.json({ data: mission }, { status: 201 });
}
