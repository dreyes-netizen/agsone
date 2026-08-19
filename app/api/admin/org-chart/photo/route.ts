import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
import { destroyCloudinaryAsset } from "@/lib/cloudinary/destroy";

const schema = z.object({
  userId: z.string().uuid(),
  publicId: z.string().min(1).nullable(),
});

// Sets or clears the org-chart-only photo override. Upload itself already
// happened client-side (uploadOrgChartPhoto, signed via /api/upload/sign) —
// this route only persists the reference and cleans up the asset it
// replaces. Never touches User.avatarUrl.
export async function PATCH(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { userId, publicId } = parsed.data;

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, orgChartPhotoPublicId: true },
  });
  if (!before) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  await prisma.user.update({ where: { id: userId }, data: { orgChartPhotoPublicId: publicId } });

  // Fire-and-forget: a failed cleanup of the OLD asset should never fail the
  // request that already persisted the new state.
  if (before.orgChartPhotoPublicId && before.orgChartPhotoPublicId !== publicId) {
    destroyCloudinaryAsset(before.orgChartPhotoPublicId).catch(() => {});
  }

  await writeAuditLog({
    actorId: user.id,
    action: "ORG_CHART_PHOTO_UPDATE",
    entityType: "User",
    entityId: userId,
    target: { userId, userName: before.displayName },
    before: { orgChartPhotoPublicId: before.orgChartPhotoPublicId },
    after: { orgChartPhotoPublicId: publicId },
  });

  scheduleBroadcast([{ topic: realtimeTopics.orgChart }, { topic: realtimeTopics.adminAudit }]);

  return NextResponse.json({ data: { ok: true } });
}
