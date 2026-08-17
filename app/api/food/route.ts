import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const addOnSchema = z.object({ name: z.string().min(1).max(100), price: z.number().min(0) });

const createSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    price: z.number().positive().transform((v) => Math.round(v * 100) / 100),
    imageUrls: z.array(z.string().url()).max(3).default([]),
    cutoffAt: z.string().datetime(),
    deliveryDate: z.string().datetime(),
    addOns: z.array(addOnSchema).max(10).default([]),
  })
  .refine((data) => new Date(data.deliveryDate) > new Date(data.cutoffAt), {
    message: "Delivery date must be after the order cutoff",
    path: ["deliveryDate"],
  });

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The client fetches this once and filters into 3 tabs (Available / My
  // Orders / My Listings) client-side rather than paginating per-tab, so
  // this can't take a small `take` without silently dropping older listings
  // from "My Orders"/"My Listings". 200 is a bound rather than true
  // pagination — comfortably above realistic usage (this table has no
  // cleanup job, so it grows indefinitely) without a client rework.
  const listings = await prisma.foodListing.findMany({
    where: {
      OR: [
        { isActive: true },
        { createdById: authUser.id },
        { orders: { some: { userId: authUser.id } } },
      ],
    },
    include: {
      createdBy: { select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } } },
      orders: {
        where: { userId: authUser.id },
        select: { id: true, quantity: true, note: true, createdAt: true, selectedAddOns: true, paidAt: true },
      },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // The seller dashboard (Selling tab) needs every order on every listing the
  // caller owns — not just their own order like the `orders` include above.
  // One batched query keyed off the caller's own listing ids, rather than a
  // per-listing fetch, keeps this at 2 queries total regardless of how many
  // listings the caller sells.
  const ownListingIds = listings.filter((l) => l.createdById === authUser.id).map((l) => l.id);
  const ownOrders = ownListingIds.length
    ? await prisma.foodOrder.findMany({
        where: { listingId: { in: ownListingIds } },
        select: {
          id: true,
          listingId: true,
          quantity: true,
          note: true,
          selectedAddOns: true,
          paidAt: true,
          createdAt: true,
          user: { select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const ownOrdersByListing = new Map<string, typeof ownOrders>();
  for (const o of ownOrders) {
    const arr = ownOrdersByListing.get(o.listingId);
    if (arr) arr.push(o);
    else ownOrdersByListing.set(o.listingId, [o]);
  }

  const data = listings.map((l) => ({
    ...l,
    price: l.price.toString(),
    myOrder: l.orders[0] ?? null,
    orders: l.createdById === authUser.id ? (ownOrdersByListing.get(l.id) ?? []) : undefined,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join(".") || "root"}: ${first.message}` : "Validation failed";
    console.error("[food POST] validation failed:", JSON.stringify(parsed.error.issues));
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { title, description, price, imageUrls, cutoffAt, deliveryDate, addOns } = parsed.data;

  if (new Date(cutoffAt) <= new Date()) {
    return NextResponse.json({ error: "Cutoff must be in the future" }, { status: 400 });
  }

  const listing = await prisma.foodListing.create({
    data: {
      title,
      description: description ?? null,
      price,
      imageUrls,
      cutoffAt: new Date(cutoffAt),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      addOns,
      createdById: authUser.id,
    },
  });

  scheduleBroadcast([{ topic: realtimeTopics.food }]);

  return NextResponse.json({ data: { ...listing, price: listing.price.toString() } }, { status: 201 });
}
