import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  caption: z.string().min(1).max(500),
  imageUrl: z.string().url(),
  stockQuantity: z.number().int().min(0),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const medicines = await prisma.medicineItem.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      caption: true,
      stockQuantity: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: medicines });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const medicine = await prisma.medicineItem.create({
    data: { ...parsed.data, createdById: user!.id },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      caption: true,
      stockQuantity: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: medicine }, { status: 201 });
}
