import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const medicine = await prisma.medicineItem.findUnique({
    where: { id },
    select: { id: true, isActive: true, stockQuantity: true },
  });
  if (!medicine || !medicine.isActive) {
    return NextResponse.json({ error: "Medicine not found" }, { status: 404 });
  }
  if (medicine.stockQuantity <= 0) {
    return NextResponse.json({ error: "Out of stock" }, { status: 409 });
  }

  const existing = await prisma.medicineRequest.findFirst({
    where: { medicineId: id, userId: user.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending request for this medicine" },
      { status: 409 }
    );
  }

  const request = await prisma.medicineRequest.create({
    data: { medicineId: id, userId: user.id },
    select: { id: true, medicineId: true, status: true, createdAt: true },
  });

  return NextResponse.json({ data: request }, { status: 201 });
}
