import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let quantity = 1;
  try {
    const body = await req.json();
    quantity = Number(body.quantity) || 1;
  } catch {
    // body may be empty — default to 1
  }
  if (quantity < 1) quantity = 1;

  const [medicine, existing] = await Promise.all([
    prisma.medicineItem.findUnique({
      where: { id },
      select: { id: true, isActive: true, stockQuantity: true },
    }),
    prisma.medicineRequest.findFirst({
      where: { medicineId: id, userId: user.id, status: "PENDING" },
      select: { id: true },
    }),
  ]);
  if (!medicine || !medicine.isActive) {
    return NextResponse.json({ error: "Medicine not found" }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json({ error: "Request already pending" }, { status: 409 });
  }
  if (medicine.stockQuantity <= 0) {
    return NextResponse.json({ error: "Out of stock" }, { status: 409 });
  }
  if (quantity > medicine.stockQuantity) {
    return NextResponse.json(
      { error: `Only ${medicine.stockQuantity} units available` },
      { status: 409 }
    );
  }

  const request = await prisma.medicineRequest.create({
    data: { medicineId: id, userId: user.id, quantity },
    select: { id: true, medicineId: true, quantity: true, status: true, createdAt: true },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.medicineUser(user.id) },
    { topic: realtimeTopics.medicineRequests },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: request }, { status: 201 });
}
