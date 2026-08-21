import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";

const editSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  content: z.string().min(1).max(1000).optional(),
});

// Single-post lookup, used by the notification bell's deep links (mentions,
// comments, reactions) to pull in a post that isn't on the reader's currently
// loaded feed page — e.g. an older post, or one under a different filter than
// whatever the feed happened to be showing when the link was opened.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await prisma.socialPost.findFirst({
    where: { id, ...postVisibilityWhere(user) },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } } },
      shoutoutRecipients: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } } } } },
      department: { select: { name: true } },
      _count: { select: { comments: true } },
      pollOptions: { include: { _count: { select: { votes: true } } } },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [myVote, reactionCounts, myReactions] = await Promise.all([
    prisma.pollVote.findFirst({ where: { userId: user.id, postId: id }, select: { optionId: true } }),
    prisma.socialReaction.groupBy({ by: ["emoji"], where: { postId: id }, _count: true }),
    prisma.socialReaction.findMany({ where: { postId: id, userId: user.id }, select: { emoji: true } }),
  ]);

  const imageUrls = post.imageUrls.length > 0 ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];
  const enriched = {
    ...post,
    imageUrls,
    reactions: Object.fromEntries(reactionCounts.map((r) => [r.emoji, r._count])),
    myReactions: myReactions.map((r) => r.emoji),
    commentCount: post._count.comments,
    myVoteOptionId: myVote?.optionId ?? null,
  };

  return NextResponse.json({ data: enriched });
}

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
    const isAdmin = user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN";
    if (post.authorId !== user.id && !isAdmin) {
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

    scheduleBroadcast([{ topic: realtimeTopics.feed }]);

    return NextResponse.json({ data: updated });
  }

  // Pin toggle — HR/Super admin only
  if (user.role !== "HR_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const post = await prisma.socialPost.findUnique({ where: { id }, select: { isPinned: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.socialPost.update({
    where: { id },
    data: { isPinned: !post.isPinned },
    select: { id: true, isPinned: true },
  });

  scheduleBroadcast([{ topic: realtimeTopics.feed }]);

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: { authorId: true, content: true, type: true, author: { select: { displayName: true } } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN";
  if (post.authorId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.socialPost.delete({ where: { id } });

  if (isAdmin && post.authorId !== user.id) {
    await writeAuditLog({
      actorId: user.id,
      action: "DELETE_POST",
      entityType: "SocialPost",
      entityId: id,
      before: { authorId: post.authorId, authorName: post.author.displayName, type: post.type, content: post.content.slice(0, 500) },
    });
  }

  scheduleBroadcast([
    { topic: realtimeTopics.feed },
    ...(isAdmin && post.authorId !== user.id ? [{ topic: realtimeTopics.adminAudit }] : []),
  ]);

  return NextResponse.json({ success: true });
}
