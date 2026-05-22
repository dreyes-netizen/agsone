import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  imageUrls: z.array(z.string().url()).max(3).default([]),
  cutoffAt: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = await prisma.foodListing.findMany({
    include: {
      createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      orders: {
        where: { userId: authUser.id },
        select: { id: true, quantity: true, note: true, createdAt: true },
      },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = listings.map((l) => ({
    ...l,
    price: l.price.toString(),
    myOrder: l.orders[0] ?? null,
    orders: undefined,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, price, imageUrls, cutoffAt } = parsed.data;

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
      createdById: authUser.id,
    },
  });

  return NextResponse.json({ data: { ...listing, price: listing.price.toString() } }, { status: 201 });
}
