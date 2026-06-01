import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const request = await prisma.medicineRequest.findUnique({
    where: { id },
    select: { id: true, status: true, medicineId: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
  }

  if (parsed.data.action === "approve") {
    const medicine = await prisma.medicineItem.findUnique({
      where: { id: request.medicineId },
      select: { stockQuantity: true },
    });
    if (!medicine || medicine.stockQuantity <= 0) {
      return NextResponse.json({ error: "Out of stock" }, { status: 409 });
    }

    const [updatedRequest] = await prisma.$transaction([
      prisma.medicineRequest.update({
        where: { id },
        data: { status: "APPROVED", approvedById: user!.id, approvedAt: new Date() },
        select: { id: true, status: true, approvedAt: true, approvedById: true },
      }),
      prisma.medicineItem.update({
        where: { id: request.medicineId },
        data: { stockQuantity: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ data: updatedRequest });
  }

  const updatedRequest = await prisma.medicineRequest.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user!.id, approvedAt: new Date() },
    select: { id: true, status: true, approvedAt: true, approvedById: true },
  });

  return NextResponse.json({ data: updatedRequest });
}
