import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";
import { createNotification } from "@/lib/helpers/createNotification";

const voteSchema = z.object({ optionId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Department-scoped, matching GET /api/feed and the react route. Previously
  // unscoped: any authenticated employee who knew a post id could vote in a
  // poll they cannot see, which would also have leaked the poll's existence
  // through the notification this now sends its author.
  const post = await prisma.socialPost.findFirst({
    where: { id, ...postVisibilityWhere(user) },
    select: { type: true, authorId: true, pollOptions: { select: { id: true } } },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.type !== "POLL") return NextResponse.json({ error: "Post is not a poll" }, { status: 400 });

  const validOption = post.pollOptions.some((o) => o.id === parsed.data.optionId);
  if (!validOption) return NextResponse.json({ error: "Invalid option" }, { status: 400 });

  // upsert returns no indication of insert-vs-update, and a user changing their
  // vote should not re-notify. Check first so only a genuinely new vote counts.
  const priorVote = await prisma.pollVote.findUnique({
    where: { postId_userId: { postId: id, userId: user.id } },
    select: { id: true },
  });

  await prisma.pollVote.upsert({
    where: { postId_userId: { postId: id, userId: user.id } },
    update: { optionId: parsed.data.optionId },
    create: { postId: id, optionId: parsed.data.optionId, userId: user.id },
  });

  // Off by default in the catalog — a poll author does not usually want a ping
  // per vote, but for a small team poll some do, so it is opt-in rather than
  // absent. Grouped by post either way.
  if (!priorVote && post.authorId !== user.id) {
    void createNotification({
      userId: post.authorId,
      type: "POLL_VOTE",
      title: `${user.displayName} voted in your poll`,
      body: "Open the poll to see the current results.",
      data: { postId: id },
    }).catch((err) => console.error("poll vote notification failed", err));
  }

  const pollOptions = await prisma.pollOption.findMany({
    where: { postId: id },
    select: { id: true, text: true, _count: { select: { votes: true } } },
  });

  scheduleBroadcast([{ topic: realtimeTopics.feed }]);

  return NextResponse.json({ data: { pollOptions, myVoteOptionId: parsed.data.optionId } });
}
