import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { REACTION_EMOJIS } from "@/lib/constants/reactions";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";

const schema = z.object({ emoji: z.enum(REACTION_EMOJIS) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { emoji } = parsed.data;

  // Same department-visibility scoping as GET /api/feed. Without this, any
  // authenticated employee who knows a post id could react to a post they
  // can't otherwise see.
  const post = await prisma.socialPost.findFirst({
    where: { id, ...postVisibilityWhere(user) },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find any existing reaction from this user on this post (any emoji)
  const existing = await prisma.socialReaction.findFirst({
    where: { postId: id, userId: user.id },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      // Same emoji — toggle off
      await prisma.socialReaction.delete({ where: { id: existing.id } });
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "removed", emoji });
    } else {
      // Different emoji — swap
      await prisma.socialReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "changed", emoji, previous: existing.emoji });
    }
  }

  try {
    await prisma.socialReaction.create({ data: { postId: id, userId: user.id, emoji } });
  } catch (err) {
    // Two concurrent first-time reactions can both pass the findFirst check and
    // race to create, the second hitting the @@unique([postId,userId,emoji])
    // constraint. That's a benign no-op (the reaction exists), not a 500.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      scheduleBroadcast([{ topic: realtimeTopics.feed }]);
      return NextResponse.json({ action: "added", emoji });
    }
    throw err;
  }
  scheduleBroadcast([{ topic: realtimeTopics.feed }]);
  return NextResponse.json({ action: "added", emoji });
}
