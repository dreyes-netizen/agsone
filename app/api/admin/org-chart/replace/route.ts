import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

const schema = z.object({
  oldUserId: z.string().uuid(),
  newUserId: z.string().uuid(),
});

// Replaces a person in the org chart (e.g. after a resignation) without
// touching the rest of the reporting hierarchy: the replacement inherits the
// outgoing person's slot (position/manager/decorative fields), everyone who
// reported to the outgoing person is repointed at the replacement, and the
// outgoing person is removed from the chart.
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { oldUserId, newUserId } = parsed.data;
  if (oldUserId === newUserId) {
    return NextResponse.json({ error: "Replacement must be a different person" }, { status: 400 });
  }

  const [oldUser, newUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: oldUserId },
      select: { id: true, displayName: true, position: true, managerId: true, orgChartHighlight: true, orgChartDashed: true },
    }),
    prisma.user.findUnique({ where: { id: newUserId }, select: { id: true, displayName: true } }),
  ]);

  if (!oldUser || !oldUser.position) {
    return NextResponse.json({ error: "That person is not currently in the org chart" }, { status: 404 });
  }
  if (!newUser) {
    return NextResponse.json({ error: "Replacement employee not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: newUserId },
      data: {
        position: oldUser.position,
        managerId: oldUser.managerId,
        orgChartHighlight: oldUser.orgChartHighlight,
        orgChartDashed: oldUser.orgChartDashed,
      },
    }),
    prisma.user.updateMany({
      where: { managerId: oldUserId },
      data: { managerId: newUserId },
    }),
    prisma.user.update({
      where: { id: oldUserId },
      data: { position: null, orgChartHighlight: null, orgChartDashed: false },
    }),
  ]);

  await writeAuditLog({
    actorId: user.id,
    action: "ORG_CHART_REPLACE",
    entityType: "User",
    entityId: newUserId,
    target: { userId: newUserId, userName: newUser.displayName },
    before: { position: oldUser.position, previousUserId: oldUserId, previousUserName: oldUser.displayName },
    after: { position: oldUser.position },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.orgChart },
    { topic: realtimeTopics.employees },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: { ok: true } });
}
