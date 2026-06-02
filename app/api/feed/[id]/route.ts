import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "HR_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const post = await prisma.socialPost.findUnique({ where: { id }, select: { isPinned: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.socialPost.update({
    where: { id },
    data: { isPinned: !post.isPinned },
    select: { id: true, isPinned: true },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await prisma.socialPost.findUnique({ where: { id }, select: { authorId: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the author or an HR_ADMIN can delete
  if (post.authorId !== user.id && user.role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.socialPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
