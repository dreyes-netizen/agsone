import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { HR_REQUEST_STATUS_LABEL } from "@/lib/constants/hrRequestStatus";

const patchSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "DONE"]),
  adminNote: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.hrRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      userId: true,
      typeId: true,
      subject: true,
      user: { select: { displayName: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid status";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { status, adminNote } = parsed.data;

  // Compare-and-swap, mirroring the medicine queue's double-decision guard: if
  // another admin already moved this row to the same status, the second write
  // loses rather than firing a duplicate notification.
  const { count } = await prisma.hrRequest.updateMany({
    where: { id, status: { not: status } },
    data: {
      status,
      ...(adminNote !== undefined ? { adminNote } : {}),
      // Records who first picked the request up, and doesn't overwrite that
      // when it later moves on to DONE.
      ...(existing.status === "NEW" ? { handledById: user.id, handledAt: new Date() } : {}),
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "That request was already updated" }, { status: 409 });
  }

  const updated = await prisma.hrRequest.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, adminNote: true, handledAt: true, handledById: true },
  });

  // Fire-and-forget: a failed notification must not undo a decision that has
  // already been committed. Quotes the subject only — `fields` and `body` can
  // carry SSS/Pag-IBIG/TIN numbers and push renders on a lock screen.
  void createNotification({
    userId: existing.userId,
    type: "HR_REQUEST_UPDATED",
    title: status === "DONE" ? "HR request completed" : "HR request update",
    body: `Your request "${existing.subject}" is now ${HR_REQUEST_STATUS_LABEL[status] ?? status}.`,
    data: { hrRequestId: id },
  }).catch((err) => console.error("hr request status notification failed", err));

  // A decision made about a named person — the audit rule in
  // lib/constants/auditActions.ts. Deliberately logs the transition only: no
  // `fields`, no `body`, no `notes`, matching how the whistleblower route
  // records a status change without the report's contents.
  await writeAuditLog({
    actorId: user.id,
    action: "HR_REQUEST_STATUS",
    entityType: "HrRequest",
    entityId: id,
    target: { userId: existing.userId, userName: existing.user.displayName },
    after: { typeId: existing.typeId, fromStatus: existing.status, toStatus: status },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.hrRequests },
    { topic: realtimeTopics.hrRequestsUser(existing.userId) },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ data: updated });
}
