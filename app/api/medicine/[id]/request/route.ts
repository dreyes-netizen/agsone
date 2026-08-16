import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { notifyRole, ADMIN_ROLES } from "@/lib/helpers/notifyRole";

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
      // name is used in the admin queue notification below.
      select: { id: true, name: true, isActive: true, stockQuantity: true },
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

  // Push the queue arrival to whoever currently holds an approver role. The
  // medicine queue was previously pull-only: a request sat PENDING until an
  // admin happened to open /admin/medicine. Grouped by the catalog, so a burst
  // of requests collapses into one "N requests waiting" row rather than N.
  void notifyRole([...ADMIN_ROLES], {
    type: "MEDICINE_REQUESTED",
    title: "Medicine request waiting",
    body: `${user.displayName} requested ${medicine.name} (x${quantity}).`,
    data: { requestId: request.id, medicineId: medicine.id },
  });

  scheduleBroadcast([
    { topic: realtimeTopics.medicineUser(user.id) },
    { topic: realtimeTopics.medicineRequests },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: request }, { status: 201 });
}
