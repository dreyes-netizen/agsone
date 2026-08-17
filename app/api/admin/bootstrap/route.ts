import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { timingSafeCompare } from "@/lib/auth/timingSafeCompare";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

// One-time route: promotes the calling user to HR_ADMIN
// Disabled automatically once any HR_ADMIN exists
export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-bootstrap-secret');
  if (!process.env.BOOTSTRAP_SECRET || !provided || !timingSafeCompare(provided, process.env.BOOTSTRAP_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Block if an HR_ADMIN already exists
  const [existingAdmin, before] = await Promise.all([
    prisma.user.findFirst({ where: { role: "HR_ADMIN" } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }),
  ]);

  if (existingAdmin) {
    return NextResponse.json(
      { error: "An HR Admin already exists. This route is disabled." },
      { status: 403 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "HR_ADMIN" },
    select: { displayName: true, email: true, role: true },
  });

  // This is a self-promotion gated only by a shared secret header, not a
  // reviewed admin action — worth its own audit row even though actor and
  // target are the same person.
  await writeAuditLog({
    actorId: user.id,
    action: "UPDATE_ROLE",
    entityType: "User",
    entityId: user.id,
    target: { userId: user.id, userName: updated.displayName },
    before: { role: before?.role ?? "EMPLOYEE" },
    after: { role: "HR_ADMIN" },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.profile(user.id) },
    { topic: realtimeTopics.employees },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({
    message: `${updated.displayName} has been promoted to HR_ADMIN.`,
    data: updated,
  });
}
