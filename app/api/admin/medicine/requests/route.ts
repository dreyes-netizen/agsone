import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to + "T23:59:59.999Z");
  }

  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.medicineRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        medicine: { select: { id: true, name: true, imageUrl: true } },
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        approvedBy: { select: { id: true, displayName: true } },
      },
    }),
    prisma.medicineRequest.count({ where }),
  ]);

  return NextResponse.json(paginatedResponse(requests, total, page, limit));
}
