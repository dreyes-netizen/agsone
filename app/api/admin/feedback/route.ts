import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/generated/prisma/client";
import { confidentialRealtimeTopic } from "@/lib/realtime/confidentialTopics";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);
  const statusFilter = searchParams.get("status") as FeedbackStatus | null;
  const categoryFilter = searchParams.get("category") as FeedbackCategory | null;

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  };

  const [feedbacks, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        category: true,
        title: true,
        status: true,
        isAnonymous: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { replies: true } },
        author: { select: { displayName: true, avatarUrl: true } },
      },
    }),
    prisma.feedback.count({ where }),
  ]);

  const sanitized = feedbacks.map((f) => ({
    ...f,
    author: f.isAnonymous ? null : f.author,
  }));

  return NextResponse.json({
    ...paginatedResponse(sanitized, total, page, limit),
    realtimeTopic: confidentialRealtimeTopic("feedback-admin"),
  });
}
