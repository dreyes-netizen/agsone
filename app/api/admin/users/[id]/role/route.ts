import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const schema = z.object({
  role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"]),
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
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Only SUPER_ADMIN can assign HR_ADMIN/SUPER_ADMIN, or change the role of
  // a user who currently holds one of those roles (prevents an HR_ADMIN from
  // demoting/stripping another HR_ADMIN or a SUPER_ADMIN).
  const elevatedRoles = ["HR_ADMIN", "SUPER_ADMIN"];
  if (
    (elevatedRoles.includes(parsed.data.role) || elevatedRoles.includes(target.role)) &&
    user.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Only Super Admin can modify elevated roles" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, displayName: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "UPDATE_ROLE",
      entityType: "User",
      entityId: id,
      afterState: { role: parsed.data.role },
    },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.employees },
    { topic: realtimeTopics.profile(id) },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: updated });
}
