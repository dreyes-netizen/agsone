import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);
  const requestedUserId = searchParams.get("userId");

  // Employees can only view their own history; managers/admins can view anyone's or all
  if (requestedUserId && requestedUserId !== user.id && user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isAdmin = user.role === "HR_ADMIN" || user.role === "MANAGER";
  const scopeToUser = requestedUserId ?? (isAdmin ? null : user.id);
  const where = scopeToUser ? { toUserId: scopeToUser } : {};

  const [transactions, total] = await Promise.all([
    prisma.pointTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        toUser:    { select: { displayName: true } },
        fromUser:  { select: { displayName: true, avatarUrl: true } },
        createdBy: { select: { displayName: true } },
      },
    }),
    prisma.pointTransaction.count({ where }),
  ]);

  return NextResponse.json(paginatedResponse(transactions, total, page, limit));
}
