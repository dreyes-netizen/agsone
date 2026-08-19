import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
import { validateAdditionalReport } from "@/lib/orgChart/additionalReports";

const postSchema = z.object({
  userId: z.string().uuid(),
  managerId: z.string().uuid(),
  relationshipType: z.string(),
});

const deleteSchema = z.object({
  userId: z.string().uuid(),
  managerId: z.string().uuid(),
});

// Adds a secondary/support reporting relationship — never touches
// User.managerId or tree placement (see lib/orgChart/toFlow.ts). Primary
// manager changes stay exclusively PATCH /api/admin/employees/[id]'s job.
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { userId, managerId, relationshipType } = parsed.data;

  const [employee, manager] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, managerId: true, additionalReportsAsUser: { select: { managerId: true } } },
    }),
    prisma.user.findUnique({ where: { id: managerId }, select: { id: true, displayName: true, position: true } }),
  ]);

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!manager || !manager.position) {
    return NextResponse.json({ error: "That manager is not currently a chart member" }, { status: 400 });
  }

  const validationError = validateAdditionalReport({
    userId,
    managerId,
    relationshipType,
    primaryManagerId: employee.managerId,
    existingManagerIds: employee.additionalReportsAsUser.map((r) => r.managerId),
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    await prisma.orgChartAdditionalReport.create({
      data: { userId, managerId, relationshipType },
    });
  } catch (err) {
    // Unique constraint race (two admins adding the same relationship at once)
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "That additional reporting relationship already exists" }, { status: 409 });
    }
    throw err;
  }

  await writeAuditLog({
    actorId: user.id,
    action: "ORG_CHART_ADDITIONAL_REPORT_ADD",
    entityType: "User",
    entityId: userId,
    target: { userId, userName: employee.displayName },
    after: { managerId, managerName: manager.displayName, relationshipType },
  });

  scheduleBroadcast([{ topic: realtimeTopics.orgChart }, { topic: realtimeTopics.adminAudit }]);

  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { userId, managerId } = parsed.data;

  const employee = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { count } = await prisma.orgChartAdditionalReport.deleteMany({ where: { userId, managerId } });
  if (count === 0) {
    return NextResponse.json({ error: "That additional reporting relationship no longer exists" }, { status: 404 });
  }

  await writeAuditLog({
    actorId: user.id,
    action: "ORG_CHART_ADDITIONAL_REPORT_REMOVE",
    entityType: "User",
    entityId: userId,
    target: { userId, userName: employee.displayName },
    before: { managerId },
  });

  scheduleBroadcast([{ topic: realtimeTopics.orgChart }, { topic: realtimeTopics.adminAudit }]);

  return NextResponse.json({ data: { ok: true } });
}
