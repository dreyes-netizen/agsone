import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const MILESTONE_TYPES = [
  "BIRTHDAY",
  "WORK_ANNIVERSARY_1",
  "WORK_ANNIVERSARY_3",
  "WORK_ANNIVERSARY_5",
  "WORK_ANNIVERSARY_10",
] as const;

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await prisma.milestoneConfig.findMany({
    orderBy: { type: "asc" },
  });

  return NextResponse.json({ data: configs });
}

const putSchema = z.object({
  configs: z.array(
    z.object({
      type: z.enum(MILESTONE_TYPES),
      pointsReward: z.number().int().min(0).max(100000),
      isActive: z.boolean(),
    })
  ),
});

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const results = await Promise.all(
    parsed.data.configs.map((cfg) =>
      prisma.milestoneConfig.upsert({
        where: { type: cfg.type },
        create: {
          type: cfg.type,
          pointsReward: cfg.pointsReward,
          isActive: cfg.isActive,
          updatedById: user!.id,
        },
        update: {
          pointsReward: cfg.pointsReward,
          isActive: cfg.isActive,
          updatedById: user!.id,
        },
      })
    )
  );

  return NextResponse.json({ data: results });
}
