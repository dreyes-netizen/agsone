import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  imageUrls: z.array(z.string().url()).max(3).optional(),
  pointCost: z.number().int().min(1).optional(),
  stockQuantity: z.number().int().min(-1).optional(),
  category: z.enum(["PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"]).optional(),
  isActive: z.boolean().optional(),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.reward.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reward = await prisma.reward.update({
    where: { id },
    data: parsed.data,
  });

  scheduleBroadcast([
    { topic: realtimeTopics.rewards },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: reward });
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
  // ?permanent=true requests an actual row delete instead of the default hide.
  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  const existing = await prisma.reward.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrls: true,
      pointCost: true,
      stockQuantity: true,
      category: true,
      isActive: true,
      createdById: true,
      _count: { select: { redemptions: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!permanent) {
    // Soft-delete: rewards are never hard-deleted by default so redemption history stays intact.
    // Admins can restore a hidden reward by toggling isActive back to true.
    await prisma.reward.update({ where: { id }, data: { isActive: false } });
    scheduleBroadcast([
      { topic: realtimeTopics.rewards },
      { topic: realtimeTopics.adminAnalytics },
    ]);
    return NextResponse.json({ success: true });
  }

  // Hard-delete: only safe when nothing references this reward yet. A reward with
  // redemption history must stay soft-deleted (hidden) — deleting the row would either
  // orphan or fail on the Redemption.rewardId foreign key, and would erase that history.
  if (existing._count.redemptions > 0) {
    return NextResponse.json(
      {
        error: `Cannot permanently delete — ${existing._count.redemptions} redemption(s) reference this reward. Hide it instead.`,
      },
      { status: 409 }
    );
  }

  await prisma.reward.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "HARD_DELETE_REWARD",
      entityType: "Reward",
      entityId: id,
      beforeState: {
        name: existing.name,
        description: existing.description,
        imageUrls: existing.imageUrls,
        pointCost: existing.pointCost,
        stockQuantity: existing.stockQuantity,
        category: existing.category,
        isActive: existing.isActive,
        createdById: existing.createdById,
      },
    },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.rewards },
    { topic: realtimeTopics.adminAnalytics },
    { topic: realtimeTopics.adminAudit },
  ]);

  return NextResponse.json({ success: true });
}
