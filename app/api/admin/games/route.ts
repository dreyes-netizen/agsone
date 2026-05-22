import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const segmentSchema = z.object({
  label: z.string().min(1),
  pointsReward: z.number().int().min(0),
  weight: z.number().min(0.1),
  color: z.string().min(1),
});

const createSchema = z.object({
  type: z.enum(["SPIN_WHEEL", "RAFFLE"]),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  entryCostPoints: z.number().int().min(0).default(0),
  dailyPlaysLimit: z.number().int().min(1).default(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  config: z.object({
    segments: z.array(segmentSchema).optional(), // SPIN_WHEEL
    prizePoints: z.number().int().min(0).optional(), // RAFFLE
  }),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const games = await prisma.game.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { plays: true } } },
  });
  return NextResponse.json({ data: games });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { type, name, description, entryCostPoints, dailyPlaysLimit, startDate, endDate, config } = parsed.data;

  const game = await prisma.game.create({
    data: {
      type,
      name,
      description,
      entryCostPoints,
      dailyPlaysLimit,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      config,
      createdById: user!.id,
    },
  });

  return NextResponse.json({ data: game }, { status: 201 });
}
