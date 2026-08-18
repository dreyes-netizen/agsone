import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

const schema = z.object({
  managerId: z.string().uuid().nullable(),
  orderedUserIds: z.array(z.string().uuid()).min(1),
});

// Persists the left-to-right display order among siblings who share the same
// manager (or among roots, when managerId is null). Never touches managerId
// itself — reparenting is exclusively PATCH /api/admin/employees/[id]'s job,
// so this endpoint can't be used to sneak a reparent past that route's cycle
// check.
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

  const { managerId, orderedUserIds } = parsed.data;
  if (new Set(orderedUserIds).size !== orderedUserIds.length) {
    return NextResponse.json({ error: "Duplicate employee in order list" }, { status: 400 });
  }

  const currentSiblings = await prisma.user.findMany({
    where: { managerId },
    select: { id: true },
  });
  const currentIds = new Set(currentSiblings.map((s) => s.id));
  const proposedIds = new Set(orderedUserIds);

  // Requiring an exact match (not just a subset) rejects a stale client view
  // outright rather than silently dropping someone who joined/left the group
  // since the admin last fetched it.
  const sameSet = currentIds.size === proposedIds.size && [...currentIds].every((id) => proposedIds.has(id));
  if (!sameSet) {
    return NextResponse.json({ error: "That list of employees no longer matches this manager's direct reports" }, { status: 409 });
  }

  await prisma.$transaction(
    orderedUserIds.map((id, index) => prisma.user.update({ where: { id }, data: { orgChartSortOrder: index } })),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "REORDER_ORG_CHART",
    entityType: "User",
    entityId: managerId ?? "root",
    before: null,
    after: { managerId, orderedUserIds },
  });

  scheduleBroadcast([{ topic: realtimeTopics.orgChart }]);

  return NextResponse.json({ data: { ok: true } });
}
