import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const addOnSchema = z.object({ name: z.string().min(1).max(100), price: z.number().positive() });

const orderSchema = z.object({
  quantity: z.number().int().min(1).max(99),
  note: z.string().max(500).optional(),
  selectedAddOns: z.array(addOnSchema).max(10).default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const listing = await prisma.foodListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!listing.isActive || listing.cutoffAt <= new Date()) {
    return NextResponse.json({ error: "Orders closed" }, { status: 410 });
  }
  if (listing.createdById === authUser.id) {
    return NextResponse.json({ error: "Cannot order your own listing" }, { status: 403 });
  }

  const existing = await prisma.foodOrder.findUnique({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
  });
  if (existing) return NextResponse.json({ error: "Already ordered" }, { status: 409 });

  const order = await prisma.foodOrder.create({
    data: {
      listingId: id,
      userId: authUser.id,
      quantity: parsed.data.quantity,
      note: parsed.data.note ?? null,
      selectedAddOns: parsed.data.selectedAddOns,
    },
  });

  return NextResponse.json({ data: order }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const order = await prisma.foodOrder.findUnique({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
    include: { listing: { select: { cutoffAt: true, isActive: true } } },
  });
  if (!order) return NextResponse.json({ error: "No order found" }, { status: 404 });
  if (!order.listing.isActive || order.listing.cutoffAt <= new Date()) {
    return NextResponse.json({ error: "Cannot cancel after cutoff" }, { status: 410 });
  }

  await prisma.foodOrder.delete({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
  });

  return NextResponse.json({ data: null });
}
