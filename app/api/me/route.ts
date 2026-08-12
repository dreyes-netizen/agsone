import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyToken } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  // verifyAuth() would query the User row by firebaseUid, return a narrow
  // AuthUser, and then this handler would query the SAME row again by id for
  // the wider profile select below — two round trips for one row. verifyToken
  // only verifies the Firebase ID token (no DB call), so this ends up as a
  // single query.
  const uid = await verifyToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      role: true,
      pointsBalance: true,
      level: true,
      onboardingComplete: true,
      birthday: true,
      hireDate: true,
      bio: true,
      skills: true,
      isActive: true,
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

  // Mirrors the isActive gate in verifyAuth() — a deactivated employee's
  // still-valid Firebase token shouldn't be able to pull their profile either.
  if (!profile || !profile.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit isActive from the response
  const { isActive: _isActive, ...data } = profile;
  return NextResponse.json({ data });
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
