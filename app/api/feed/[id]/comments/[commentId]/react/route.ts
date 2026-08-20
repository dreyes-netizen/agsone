import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { REACTION_EMOJIS } from "@/lib/constants/reactions";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";
import { createNotification } from "@/lib/helpers/createNotification";

const schema = z.object({ emoji: z.enum(REACTION_EMOJIS) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { emoji } = parsed.data;

  // Same department-visibility scoping as every other comment/post route: a
  // comment on a post the user cannot see must not be reactable either.
  const comment = await prisma.socialComment.findFirst({
    where: { id: commentId, postId: id, post: postVisibilityWhere(user) },
    select: { id: true, authorId: true },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.commentReaction.findFirst({
    where: { commentId, userId: user.id },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "removed", emoji });
    } else {
      await prisma.commentReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "changed", emoji, previous: existing.emoji });
    }
  }

  try {
    await prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji } });
  } catch (err) {
    // Two concurrent first-time reactions can both pass the findFirst check and
    // race to create, the second hitting the @@unique([commentId,userId,emoji])
    // constraint. That's a benign no-op (the reaction exists), not a 500 — same
    // reasoning as the post react route.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "added", emoji });
    }
    throw err;
  }

  // Only a first-time reaction notifies, and never for reacting to your own
  // comment — same reasoning as the post react route.
  if (comment.authorId !== user.id) {
    void createNotification({
      userId: comment.authorId,
      type: "REACTION_ON_COMMENT",
      title: `${user.displayName} reacted to your comment`,
      body: `Reacted ${emoji}`,
      data: { postId: id, commentId },
    }).catch((err) => console.error("comment reaction notification failed", err));
  }

  scheduleBroadcast([{ topic: realtimeTopics.feed }]);
  return NextResponse.json({ action: "added", emoji });
}
