import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";

type Params = { params: Promise<{ id: string; commentId: string }> };

const editSchema = z.object({ content: z.string().min(1).max(1000) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;
  const body = await req.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const comment = await prisma.socialComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.socialComment.update({
    where: { id: commentId },
    data: { content: parsed.data.content },
    select: { id: true, content: true },
  });

  scheduleBroadcast([{ topic: realtimeTopics.feed }]);

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;

  const comment = await prisma.socialComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, content: true, postId: true, author: { select: { displayName: true } } },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN";
  if (comment.authorId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.socialComment.delete({ where: { id: commentId } });

  if (isAdmin && comment.authorId !== user.id) {
    await writeAuditLog({
      actorId: user.id,
      action: "DELETE_COMMENT",
      entityType: "SocialComment",
      entityId: commentId,
      before: {
        authorId: comment.authorId,
        authorName: comment.author.displayName,
        postId: comment.postId,
        content: comment.content?.slice(0, 500) ?? null,
      },
    });
  }

  scheduleBroadcast([
    { topic: realtimeTopics.feed },
    ...(isAdmin && comment.authorId !== user.id ? [{ topic: realtimeTopics.adminAudit }] : []),
  ]);

  return NextResponse.json({ success: true });
}
