import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { createNotification } from "@/lib/helpers/createNotification";

const schema = z.object({ paid: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, orderId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.createdById !== authUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.foodOrder.update({
    where: { id: orderId, listingId: id },
    data: { paidAt: parsed.data.paid ? new Date() : null },
  });

  // Only on marking paid. This flag is reversible, but un-marking is a seller
  // correcting their own bookkeeping — telling the buyer "your payment was
  // un-confirmed" would alarm more than it informs.
  if (parsed.data.paid && updated.userId !== authUser.id) {
    void createNotification({
      userId: updated.userId,
      type: "FOOD_ORDER_PAID",
      title: "Payment confirmed",
      body: `${authUser.displayName} confirmed your payment for "${listing.title}".`,
      data: { listingId: id, orderId },
    }).catch((err) => console.error("food paid notification failed", err));
  }

  scheduleBroadcast([{ topic: realtimeTopics.food }]);

  return NextResponse.json({ data: updated });
}
