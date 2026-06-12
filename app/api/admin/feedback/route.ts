import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/generated/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") as FeedbackStatus | null;
  const categoryFilter = searchParams.get("category") as FeedbackCategory | null;

  const feedbacks = await prisma.feedback.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    },
    orderBy: { updatedAt: "desc" },
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
  });

  const sanitized = feedbacks.map((f) => ({
    ...f,
    author: f.isAnonymous ? null : f.author,
  }));

  return NextResponse.json({ data: sanitized });
}
