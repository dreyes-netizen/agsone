import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

const schema = z.object({
  departmentId: z.string().uuid().nullable(),
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { departmentId } = parsed.data;

  if (departmentId !== null) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 400 }
      );
    }
  }

  const before = await prisma.user.findUnique({
    where: { id },
    select: { displayName: true, department: { select: { name: true } } },
  });
  if (!before) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { departmentId },
    select: {
      id: true,
      displayName: true,
      department: { select: { id: true, name: true } },
    },
  });

  if (updated.department?.name !== before.department?.name) {
    await writeAuditLog({
      actorId: user.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: id,
      target: { userId: id, userName: updated.displayName },
      after: {
        changes: {
          departmentName: { from: before.department?.name ?? null, to: updated.department?.name ?? null },
        },
      },
    });
  }

  scheduleBroadcast([
    { topic: realtimeTopics.employees },
    { topic: realtimeTopics.departments },
    { topic: realtimeTopics.leaderboard },
    { topic: realtimeTopics.profile(id) },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: updated });
}
