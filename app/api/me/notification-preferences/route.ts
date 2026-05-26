import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

const TOGGLEABLE_TYPES = [
  "SHOUTOUT_RECEIVED",
  "MISSION_COMPLETED",
  "POINTS_AWARDED",
  "MILESTONE_REWARD",
  "SHOUTOUT_RECEIVED_EMAIL",
  "MISSION_COMPLETED_EMAIL",
  "POINTS_AWARDED_EMAIL",
  "MILESTONE_REWARD_EMAIL",
] as const;

type PrefKey = (typeof TOGGLEABLE_TYPES)[number];

const DEFAULTS: Record<PrefKey, boolean> = {
  SHOUTOUT_RECEIVED: true,
  MISSION_COMPLETED: true,
  POINTS_AWARDED: true,
  MILESTONE_REWARD: true,
  SHOUTOUT_RECEIVED_EMAIL: false,
  MISSION_COMPLETED_EMAIL: false,
  POINTS_AWARDED_EMAIL: false,
  MILESTONE_REWARD_EMAIL: false,
};

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const stored = (dbUser?.notificationPrefs ?? {}) as Record<string, boolean>;
  const merged: Record<PrefKey, boolean> = { ...DEFAULTS };
  for (const key of TOGGLEABLE_TYPES) {
    if (key in stored) merged[key] = stored[key];
  }

  return NextResponse.json({ data: merged });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;

  const invalidKeys = Object.keys(body).filter(
    (k) => !(TOGGLEABLE_TYPES as readonly string[]).includes(k)
  );
  if (invalidKeys.length > 0) {
    return NextResponse.json(
      { error: `Invalid preference keys: ${invalidKeys.join(", ")}` },
      { status: 400 }
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const existing = (dbUser?.notificationPrefs ?? {}) as Record<string, boolean>;
  const updated = { ...existing, ...body };

  await prisma.user.update({
    where: { id: user.id },
    data: { notificationPrefs: updated as any },
  });

  const merged: Record<PrefKey, boolean> = { ...DEFAULTS };
  for (const key of TOGGLEABLE_TYPES) {
    if (key in updated) merged[key] = (updated as Record<string, boolean>)[key];
  }

  return NextResponse.json({ data: merged });
}
