import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  caption: z.string().min(1).max(3000),
  imageUrl: z.union([z.string().url(), z.literal("")]),
  stockQuantity: z.number().int().min(0),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const [medicines, total] = await Promise.all([
    prisma.medicineItem.findMany({
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        caption: true,
        stockQuantity: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.medicineItem.count(),
  ]);

  return NextResponse.json(paginatedResponse(medicines, total, page, limit));
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const first = Object.entries(fieldErrors)[0];
    return NextResponse.json({ error: first ? `${first[0]}: ${first[1]?.[0]}` : "Invalid request" }, { status: 400 });
  }

  const medicine = await prisma.medicineItem.create({
    data: { ...parsed.data, createdById: user.id },
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

  scheduleBroadcast([
    { topic: realtimeTopics.medicine },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: medicine }, { status: 201 });
}
