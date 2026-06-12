import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { ChallengeMetric } from "@/lib/generated/prisma/client";

const VALID_METRICS: ChallengeMetric[] = ["TOTAL_POINTS", "SHOUTOUTS_SENT"];

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const challenges = await prisma.challenge.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      metric: true,
      targetValue: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: challenges });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, metric, targetValue, startDate, endDate } = body;

  if (!title || !metric || !targetValue || !startDate || !endDate) {
    return NextResponse.json({ error: "title, metric, targetValue, startDate, endDate are required" }, { status: 400 });
  }
  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }
  if (Number(targetValue) <= 0) {
    return NextResponse.json({ error: "targetValue must be > 0" }, { status: 400 });
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 });
  }

  const challenge = await prisma.challenge.create({
    data: {
      title,
      description: description ?? null,
      metric: metric as ChallengeMetric,
      targetValue: Number(targetValue),
      startDate: start,
      endDate: end,
      createdById: user!.id,
    },
  });

  return NextResponse.json({ data: challenge }, { status: 201 });
}
