import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import type { Role } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
import { wouldCreateCycle } from "@/lib/orgChart/cycles";
import { destroyCloudinaryAsset } from "@/lib/cloudinary/destroy";

const ELEVATED_ROLES: Role[] = ["HR_ADMIN", "SUPER_ADMIN"];

const schema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  hireDate: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  position: z.string().max(200).nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  orgChartHighlight: z.enum(["gold", "teal"]).nullable().optional(),
  orgChartDashed: z.boolean().optional(),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, email, departmentId, role, isActive, hireDate, birthday, position, managerId, orgChartHighlight, orgChartDashed } = parsed.data;

  if (managerId === id) {
    return NextResponse.json({ error: "An employee cannot be their own manager" }, { status: 400 });
  }

  // Mirror the elevated-role guard in /api/admin/users/[id]/role — only
  // SUPER_ADMIN may grant HR_ADMIN. Without this, any HR_ADMIN could mint
  // more HR_ADMINs through this generic edit route.
  if (role === "HR_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admin can assign elevated roles" }, { status: 403 });
  }

  // Fetched unconditionally now (previously only for the elevated-role guard
  // below) so there's a before-state to diff against for the audit row —
  // this route used to change role/isActive/department with zero trace.
  const before = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
      displayName: true,
      email: true,
      isActive: true,
      managerId: true,
      position: true,
      orgChartPhotoPublicId: true,
      department: { select: { name: true } },
    },
  });
  if (!before) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // The elevated-role guard above only guards PROMOTION into HR_ADMIN. It
  // never inspects the target's CURRENT role, so an HR_ADMIN could still
  // demote, deactivate, or change the email of an existing HR_ADMIN/
  // SUPER_ADMIN. Only a SUPER_ADMIN may modify an already-elevated account
  // through this route.
  if (user.role !== "SUPER_ADMIN" && ELEVATED_ROLES.includes(before.role)) {
    return NextResponse.json({ error: "Only Super Admin can modify an elevated account" }, { status: 403 });
  }

  const managerChanging = managerId !== undefined && managerId !== before.managerId;

  // The `managerId === id` check above only catches a direct self-report.
  // An employee could still be reassigned under one of their own reports
  // (or a deeper descendant), which creates a cycle the layout/tree code
  // can't recover from. Walk the proposed new manager's chain looking for
  // this employee before committing.
  if (managerChanging && managerId) {
    const getManagerId = async (userId: string) => {
      const row = await prisma.user.findUnique({ where: { id: userId }, select: { managerId: true } });
      return row?.managerId ?? null;
    };
    if (await wouldCreateCycle(id, managerId, getManagerId)) {
      return NextResponse.json({ error: "This would create a circular reporting relationship." }, { status: 400 });
    }
  }

  // Leaving the chart entirely (position explicitly nulled) also drops its
  // two chart-only extras — otherwise the photo override's Cloudinary asset
  // would never get cleaned up, and stale additional-relationship rows would
  // sit there referencing someone no longer on the chart. Rows where this
  // person is the *target* of someone else's additional relationship are
  // left alone, same tolerance the app already has for a departed primary
  // manager (reports just fall back to root).
  const removingFromChart = position === null && before.position !== null;

  const updated = await prisma.$transaction(async (tx) => {
    // New manager (including null, i.e. top-of-chart) means this employee
    // joins a different sibling group — append them to the end of it rather
    // than leaving them at whatever orgChartSortOrder they had under the old
    // manager. Reordering WITHIN a group is exclusively the reorder
    // endpoint's job; this route never accepts a client-supplied sort order.
    let sortOrderData = {};
    if (managerChanging) {
      const { _max } = await tx.user.aggregate({
        where: { managerId },
        _max: { orgChartSortOrder: true },
      });
      sortOrderData = { orgChartSortOrder: (_max.orgChartSortOrder ?? -1) + 1 };
    }

    if (removingFromChart) {
      await tx.orgChartAdditionalReport.deleteMany({ where: { userId: id } });
    }

    return tx.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(hireDate !== undefined ? { hireDate: hireDate ? new Date(hireDate) : null } : {}),
        ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(managerId !== undefined ? { managerId } : {}),
        ...(orgChartHighlight !== undefined ? { orgChartHighlight } : {}),
        ...(orgChartDashed !== undefined ? { orgChartDashed } : {}),
        ...(removingFromChart ? { orgChartPhotoPublicId: null } : {}),
        ...sortOrderData,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        isActive: true,
        hireDate: true,
        birthday: true,
        position: true,
        managerId: true,
        orgChartHighlight: true,
        orgChartDashed: true,
        orgChartSortOrder: true,
        department: { select: { id: true, name: true } },
      },
    });
  });

  if (removingFromChart && before.orgChartPhotoPublicId) {
    destroyCloudinaryAsset(before.orgChartPhotoPublicId).catch(() => {});
  }

  const orgChartFieldsTouched =
    position !== undefined || managerId !== undefined || orgChartHighlight !== undefined || orgChartDashed !== undefined;

  // Only fields that actually changed go into the audit row — a PATCH that
  // only touched hireDate/birthday isn't worth a row, but role/isActive/
  // department changes always are.
  //
  // A role change gets its OWN row, in the same flat { role } shape
  // /api/admin/users/[id]/role writes — not nested under `changes` — so
  // both role-change paths render identically and the audit page's filter
  // shows them together. This route used to be the unaudited one.
  const roleChanged = role !== undefined && role !== before.role;

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (isActive !== undefined && isActive !== before.isActive) changes.isActive = { from: before.isActive, to: isActive };
  if (departmentId !== undefined && updated.department?.name !== before.department?.name) {
    changes.departmentName = { from: before.department?.name ?? null, to: updated.department?.name ?? null };
  }
  if (displayName !== undefined && displayName !== before.displayName) {
    changes.displayName = { from: before.displayName, to: displayName };
  }
  // Value is masked in the audit row — an email address is itself PII, and
  // "email updated" is all the summary line needs to render.
  if (email !== undefined && email !== before.email) changes.email = { from: "***", to: "***" };

  const loggedSomething = roleChanged || Object.keys(changes).length > 0;

  if (roleChanged) {
    await writeAuditLog({
      actorId: user.id,
      action: "UPDATE_ROLE",
      entityType: "User",
      entityId: id,
      target: { userId: id, userName: updated.displayName },
      before: { role: before.role },
      after: { role },
    });
  }
  if (Object.keys(changes).length > 0) {
    await writeAuditLog({
      actorId: user.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: id,
      target: { userId: id, userName: updated.displayName },
      after: { changes },
    });
  }

  scheduleBroadcast([
    { topic: realtimeTopics.employees },
    { topic: realtimeTopics.departments },
    { topic: realtimeTopics.leaderboard },
    { topic: realtimeTopics.profile(id) },
    { topic: realtimeTopics.adminAnalytics },
    ...(loggedSomething ? [{ topic: realtimeTopics.adminAudit }] : []),
    ...(orgChartFieldsTouched ? [{ topic: realtimeTopics.orgChart }] : []),
  ]);

  return NextResponse.json({ data: updated });
}
