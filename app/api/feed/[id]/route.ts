import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const editSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  content: z.string().min(1).max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // A bodyless PATCH = pin toggle (HR only). A PATCH with title/content = edit (author or HR).
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const isEdit =
    body !== null && typeof body === "object" && ("content" in body || "title" in body);

  if (isEdit) {
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const post = await prisma.socialPost.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (post.authorId !== user.id && user.role !== "HR_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
      },
      select: { id: true, title: true, content: true, updatedAt: true },
    });

    return NextResponse.json({ data: updated });
  }

  // Pin toggle — HR only
  if (user.role !== "HR_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
