import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { USER_PHOTO_SELECT, withOrgChartPhotoUrl } from "@/lib/orgChart/resolveAvatar";

const updateSchema = z.object({
  userId: z.string().uuid().optional(),
  position: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.userId) {
    const targetUser = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
    if (!targetUser) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
  }

  const contact = await prisma.pointOfContact.update({
    where: { id },
    data: {
      ...(parsed.data.userId !== undefined && { userId: parsed.data.userId }),
      ...(parsed.data.position !== undefined && { position: parsed.data.position }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
    select: {
      id: true,
      position: true,
      description: true,
      sortOrder: true,
      user: { select: { id: true, displayName: true, email: true, ...USER_PHOTO_SELECT } },
    },
  });

  scheduleBroadcast([{ topic: realtimeTopics.pointsOfContact }]);

  return NextResponse.json({ data: { ...contact, user: withOrgChartPhotoUrl(contact.user) } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.pointOfContact.delete({ where: { id } });

  scheduleBroadcast([{ topic: realtimeTopics.pointsOfContact }]);

  return NextResponse.json({ data: { id } });
}
