import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true, role: true } },
        },
      },
    },
  });

  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (feedback.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ data: feedback });
}
