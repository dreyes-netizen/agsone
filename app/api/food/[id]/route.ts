import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

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

  // Delete orders first (no cascade defined in schema), then the listing
  await prisma.$transaction([
    prisma.foodOrder.deleteMany({ where: { listingId: id } }),
    prisma.foodListing.delete({ where: { id } }),
  ]);

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
  deliveryDate: z.string().datetime().nullable().optional(),
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

  return NextResponse.json({ data: { ...updated, price: updated.price.toString() } });
}
