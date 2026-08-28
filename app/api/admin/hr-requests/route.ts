import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { realtimeTopics } from "@/lib/realtime/topics";
import { ALL_HR_REQUEST_STATUSES } from "@/lib/constants/hrRequestStatus";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const status = searchParams.get("status");
  const categoryId = searchParams.get("categoryId");
  const typeId = searchParams.get("typeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim();

  const where: Prisma.HrRequestWhereInput = {};

  if (status && (ALL_HR_REQUEST_STATUSES as readonly string[]).includes(status)) {
    where.status = status as Prisma.HrRequestWhereInput["status"];
  }
  if (categoryId) where.categoryId = categoryId;
  if (typeId) where.typeId = typeId;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    // Same end-of-day trick the medicine queue uses, so a `to` of "2026-08-29"
    // includes everything filed that day rather than only midnight.
    if (to) where.createdAt.lte = new Date(to + "T23:59:59.999Z");
  }

  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { user: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.hrRequest.findMany({
      where,
      // NEW first would need a CASE expression; ordering newest-first and
      // letting HR filter by status keeps this a single index scan on
      // @@index([status, createdAt]).
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            email: true,
            employeeId: true,
            department: { select: { name: true } },
          },
        },
        handledBy: { select: { id: true, displayName: true } },
      },
    }),
    prisma.hrRequest.count({ where }),
  ]);

  return NextResponse.json({
    ...paginatedResponse(requests, total, page, limit),
    realtimeTopic: realtimeTopics.hrRequests,
  });
}
