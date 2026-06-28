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

type AddOn = { name: string; price: number };

// Cross-check client-selected add-ons against the listing's authoritative list.
// Returns the listing's own {name, price} entries so a tampered client price is
// never persisted; rejects any selection that isn't offered on the listing.
function validateAddOns(
  selected: AddOn[],
  listingAddOns: unknown,
): { value: AddOn[] } | { error: string } {
  const available: AddOn[] = Array.isArray(listingAddOns)
    ? (listingAddOns as AddOn[]).filter((a) => a && typeof a.name === "string" && typeof a.price === "number")
    : [];
  const value: AddOn[] = [];
  for (const sel of selected) {
    const match = available.find((a) => a.name === sel.name);
    if (!match) return { error: `Unknown add-on: ${sel.name}` };
    value.push({ name: match.name, price: match.price });
  }
  return { value };
}

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

  // Don't trust client-supplied add-on prices: each selection must match one on
  // the listing, and we persist the listing's authoritative name + price.
  const addOns = validateAddOns(parsed.data.selectedAddOns, listing.addOns);
  if ("error" in addOns) return NextResponse.json({ error: addOns.error }, { status: 400 });

  try {
    const order = await prisma.foodOrder.create({
      data: {
        listingId: id,
        userId: authUser.id,
        quantity: parsed.data.quantity,
        note: parsed.data.note ?? null,
        selectedAddOns: addOns.value,
      },
    });
    return NextResponse.json({ data: order }, { status: 201 });
  } catch (err) {
    // Concurrent double-submit can race past the existing-order check and hit
    // the listingId_userId unique constraint — that's a 409, not a 500.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Already ordered" }, { status: 409 });
    }
    throw err;
  }
}

export async function PATCH(
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

  const order = await prisma.foodOrder.findUnique({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
    include: { listing: { select: { cutoffAt: true, isActive: true, addOns: true } } },
  });
  if (!order) return NextResponse.json({ error: "No order found" }, { status: 404 });
  if (!order.listing.isActive || order.listing.cutoffAt <= new Date()) {
    return NextResponse.json({ error: "Cannot edit after cutoff" }, { status: 410 });
  }

  const addOns = validateAddOns(parsed.data.selectedAddOns, order.listing.addOns);
  if ("error" in addOns) return NextResponse.json({ error: addOns.error }, { status: 400 });

  const updated = await prisma.foodOrder.update({
    where: { listingId_userId: { listingId: id, userId: authUser.id } },
    data: {
      quantity: parsed.data.quantity,
      note: parsed.data.note ?? null,
      selectedAddOns: addOns.value,
    },
  });

  return NextResponse.json({ data: updated });
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
