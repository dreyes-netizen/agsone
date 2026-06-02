import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  caption: z.string().min(1).max(3000).optional(),
  imageUrl: z.string().url().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const first = Object.entries(fieldErrors)[0];
    return NextResponse.json({ error: first ? `${first[0]}: ${first[1]?.[0]}` : "Invalid request" }, { status: 400 });
  }

  const existing = await prisma.medicineItem.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, caption, imageUrl, stockQuantity, isActive } = parsed.data;

  const updated = await prisma.medicineItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(caption !== undefined && { caption }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(stockQuantity !== undefined && { stockQuantity }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      caption: true,
      stockQuantity: true,
      isActive: true,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const pendingCount = await prisma.medicineRequest.count({
    where: { medicineId: id, status: "PENDING" },
  });
  if (pendingCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete: there are pending requests for this medicine" },
      { status: 409 }
    );
  }

  await prisma.medicineItem.delete({ where: { id } });
  return NextResponse.json({ data: null });
}
