import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

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
      bio: true,
      skills: true,
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

const patchSchema = z.object({
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: { bio: true, skills: true },
  });

  return NextResponse.json({ data: updated });
}
