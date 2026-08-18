import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const createSchema = z.object({
  userId: z.string().uuid(),
  position: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contacts = await prisma.pointOfContact.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      position: true,
      description: true,
      sortOrder: true,
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ data: contacts });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!targetUser) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const contact = await prisma.pointOfContact.create({
    data: {
      userId: parsed.data.userId,
      position: parsed.data.position,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
    select: {
      id: true,
      position: true,
      description: true,
      sortOrder: true,
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });

  scheduleBroadcast([{ topic: realtimeTopics.pointsOfContact }]);

  return NextResponse.json({ data: contact }, { status: 201 });
}
