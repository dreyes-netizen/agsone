import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";

const createSchema = z.object({
  name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.account.count(),
  ]);

  return NextResponse.json(paginatedResponse(accounts, total, page, limit));
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.account.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Account name already exists" },
      { status: 400 }
    );
  }

  const account = await prisma.account.create({
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true },
  });

  scheduleBroadcast([{ topic: realtimeTopics.accounts }]);

  return NextResponse.json({ data: account }, { status: 201 });
}
