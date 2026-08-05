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
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
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
    select: { id: true, status: true, medicineId: true, quantity: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
  }

  if (parsed.data.action === "approve") {
    let updatedRequest: { id: string; status: string; approvedAt: Date | null; approvedById: string | null };
    try {
      updatedRequest = await prisma.$transaction(async (tx) => {
        // Guard against a double-approve race: only claim this request if it's
        // still PENDING. A second concurrent approve/reject loses the CAS.
        const { count: requestCount } = await tx.medicineRequest.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "APPROVED", approvedById: user!.id, approvedAt: new Date() },
        });
        if (requestCount === 0) {
          throw new Error("ALREADY_PROCESSED");
        }
        // Guard the stock decrement the same way — only decrement if enough
        // stock is still available, so two concurrent approvals can't jointly
        // over-draw a shared medicine item.
        const { count: stockCount } = await tx.medicineItem.updateMany({
          where: { id: request.medicineId, stockQuantity: { gte: request.quantity } },
          data: { stockQuantity: { decrement: request.quantity } },
        });
        if (stockCount === 0) {
          throw new Error("OUT_OF_STOCK");
        }
        return tx.medicineRequest.findUniqueOrThrow({
          where: { id },
          select: { id: true, status: true, approvedAt: true, approvedById: true },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "OUT_OF_STOCK") {
        return NextResponse.json({ error: "Out of stock" }, { status: 409 });
      }
      if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
        return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ data: updatedRequest });
  }

  const { count } = await prisma.medicineRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", approvedById: user!.id, approvedAt: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
  }

  const updatedRequest = await prisma.medicineRequest.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, approvedAt: true, approvedById: true },
  });

  return NextResponse.json({ data: updatedRequest });
}
