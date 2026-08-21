import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyToken } from "@/lib/auth/verifyAuth";
import { PROFILE_SELECT, stripInternal } from "@/lib/auth/profileSelect";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

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
    select: PROFILE_SELECT,
  });

  // Mirrors the isActive gate in verifyAuth() — a deactivated employee's
  // still-valid Firebase token shouldn't be able to pull their profile either.
  if (!profile || !profile.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: stripInternal(profile) });
}

const patchSchema = z.object({
  bio: z.string().max(500, "Bio must be 500 characters or fewer").optional(),
  skills: z.array(z.string().min(1).max(250, "Each skill must be 250 characters or fewer"))
    .max(20, "You can add up to 20 skills")
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid profile data";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: { bio: true, skills: true },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.profile(user.id) },
    { topic: realtimeTopics.employees },
  ]);

  return NextResponse.json({ data: updated });
}
