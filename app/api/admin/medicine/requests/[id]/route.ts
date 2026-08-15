import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { createNotification } from "@/lib/helpers/createNotification";

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
    // medicine.name is selected for the notification body — "Paracetamol"
    // is the whole point of the message, and pulling it here avoids a second
    // round trip after the transaction.
    select: {
      id: true,
      status: true,
      medicineId: true,
      quantity: true,
      userId: true,
      medicine: { select: { name: true } },
    },
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
          data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
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

    // Tell the requester. Until now the outcome of a decision made about a
    // named person was discoverable only by reopening /medicine and re-reading
    // their own list. Fire-and-forget: a failed notification must not undo an
    // approval that has already decremented stock.
    void createNotification({
      userId: request.userId,
      type: "MEDICINE_APPROVED",
      title: "Medicine request approved",
      body: `Your request for ${request.medicine.name} (x${request.quantity}) is approved — you can collect it from HR.`,
      data: { requestId: request.id, medicineId: request.medicineId },
    }).catch((err) => console.error("medicine approve notification failed", err));

    scheduleBroadcast([
      { topic: realtimeTopics.medicine },
      { topic: realtimeTopics.medicineRequests },
      { topic: realtimeTopics.medicineUser(request.userId) },
      { topic: realtimeTopics.adminAnalytics },
    ]);
    return NextResponse.json({ data: updatedRequest });
  }

  const { count } = await prisma.medicineRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
  }

  const updatedRequest = await prisma.medicineRequest.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, approvedAt: true, approvedById: true },
  });

  void createNotification({
    userId: request.userId,
    type: "MEDICINE_REJECTED",
    title: "Medicine request declined",
    body: `Your request for ${request.medicine.name} (x${request.quantity}) was declined. Speak to HR if you need more detail.`,
    data: { requestId: request.id, medicineId: request.medicineId },
  }).catch((err) => console.error("medicine reject notification failed", err));

  scheduleBroadcast([
    { topic: realtimeTopics.medicineRequests },
    { topic: realtimeTopics.medicineUser(request.userId) },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: updatedRequest });
}
