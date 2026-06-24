import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

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

  const reward = await prisma.reward.update({
    where: { id },
    data: parsed.data,
  });

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
  // Soft-delete: rewards are never hard-deleted so redemption history stays intact.
  // Admins can restore a hidden reward by toggling isActive back to true.
  await prisma.reward.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
