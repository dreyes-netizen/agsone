import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { createNotification } from "@/lib/helpers/createNotification";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.createdById !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Capture who had ordered BEFORE the delete — afterwards there is no record
  // of them. Deleting a listing wipes out every order on it, including ones the
  // seller already marked paid, so these buyers have to be told; the row simply
  // vanishing from their "My Orders" tab was the only signal they used to get.
  const affectedBuyers = await prisma.foodOrder.findMany({
    where: { listingId: id },
    select: { userId: true, paidAt: true },
  });

  // Delete orders first (no cascade defined in schema), then the listing
  await prisma.$transaction([
    prisma.foodOrder.deleteMany({ where: { listingId: id } }),
    prisma.foodListing.delete({ where: { id } }),
  ]);

  void Promise.allSettled(
    affectedBuyers
      .filter((o) => o.userId !== authUser.id)
      .map((o) =>
        createNotification({
          userId: o.userId,
          type: "FOOD_LISTING_CANCELLED",
          title: "A listing you ordered from was removed",
          body: o.paidAt
            ? `${authUser.displayName} deleted "${listing.title}". Your order was already marked paid — contact them directly.`
            : `${authUser.displayName} deleted "${listing.title}", so your order has been cancelled.`,
          data: { listingId: id },
        }),
      ),
  ).catch((err) => console.error("food listing delete notifications failed", err));

  scheduleBroadcast([{ topic: realtimeTopics.food }]);

  return NextResponse.json({ data: null });
}

const addOnSchema = z.object({ name: z.string().min(1).max(100), price: z.number().min(0) });

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().positive().transform((v) => Math.round(v * 100) / 100).optional(),
  imageUrls: z.array(z.string().url()).max(3).optional(),
  cutoffAt: z.string().datetime().optional(),
  deliveryDate: z.string().datetime().optional(),
  addOns: z.array(addOnSchema).max(10).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.createdById !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { isActive, title, description, price, imageUrls, cutoffAt, deliveryDate, addOns } = parsed.data;

  const effectiveCutoff = cutoffAt ? new Date(cutoffAt) : listing.cutoffAt;
  const effectiveDelivery = deliveryDate ? new Date(deliveryDate) : listing.deliveryDate;
  if (effectiveDelivery && effectiveDelivery <= effectiveCutoff) {
    return NextResponse.json({ error: "Delivery date must be after the order cutoff" }, { status: 400 });
  }

  const updated = await prisma.foodListing.update({
    where: { id },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(imageUrls !== undefined && { imageUrls }),
      ...(cutoffAt !== undefined && { cutoffAt: new Date(cutoffAt) }),
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
      ...(addOns !== undefined && { addOns }),
    },
  });

  // Closing a listing early locks existing buyers out of editing or cancelling
  // their order (both routes 410 once the listing is inactive or past cutoff),
  // so it needs the same signal as a delete. Only fires on the isActive
  // true -> false transition; price and title edits are not worth a
  // notification each.
  if (isActive === false && listing.isActive) {
    const buyers = await prisma.foodOrder.findMany({
      where: { listingId: id },
      select: { userId: true },
    });
    void Promise.allSettled(
      buyers
        .filter((o) => o.userId !== authUser.id)
        .map((o) =>
          createNotification({
            userId: o.userId,
            type: "FOOD_LISTING_CANCELLED",
            title: "A listing you ordered from was closed",
            body: `${authUser.displayName} closed "${listing.title}" to further changes.`,
            data: { listingId: id },
          }),
        ),
    ).catch((err) => console.error("food listing close notifications failed", err));
  }

  scheduleBroadcast([{ topic: realtimeTopics.food }]);

  return NextResponse.json({ data: { ...updated, price: updated.price.toString() } });
}
