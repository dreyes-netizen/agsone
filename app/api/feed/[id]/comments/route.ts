import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { GIF_PROVIDERS, GIF_ID_PATTERN } from "@/lib/constants/gif";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";
import { createNotification } from "@/lib/helpers/createNotification";
import { resolveMentionRecipients, stripMentionTokens } from "@/lib/helpers/parseMentions";

const authorSelect = { id: true, displayName: true, avatarUrl: true };

const COMMENT_PAGE_SIZE = 20;

// A GIF comment carries only the provider's id (never a media URL — the
// client resolves current media live from the provider by id, see
// lib/giphy/client.ts) plus optional caption text. A text comment requires
// non-empty content. Either way `content` tops out at 1000 chars.
const commentSchema = z
  .object({
    content: z.string().max(1000).optional(),
    parentId: z.string().uuid().optional(),
    commentType: z.enum(["TEXT", "GIF"]).default("TEXT"),
    gifProvider: z.enum(GIF_PROVIDERS).optional(),
    gifId: z.string().regex(GIF_ID_PATTERN).optional(),
  })
  .refine(
    (data) =>
      data.commentType === "GIF"
        ? Boolean(data.gifProvider && data.gifId)
        : Boolean(data.content && data.content.trim().length > 0),
    { message: "A text comment needs content; a GIF comment needs gifProvider and gifId." }
  );

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  // Guard against NaN / negative limits, same as GET /api/feed.
  const parsedLimit = parseInt(searchParams.get("limit") ?? String(COMMENT_PAGE_SIZE), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), COMMENT_PAGE_SIZE) : COMMENT_PAGE_SIZE;

  // Top-level comments are fetched newest-first with a cursor so the default
  // view is always "the most recent page" — a "View earlier comments" button
  // pages backward through older cursors. Reversed back to chronological
  // (oldest-of-this-page first) below so the thread still reads top-to-bottom.
  // Replies stay a flat, generous cap (a reply thread this deep is
  // pathological, not a real pagination case) behind the existing
  // collapse-by-default "View replies" toggle.
  const rows = await prisma.socialComment.findMany({
    where: { postId: id, parentId: null, post: postVisibilityWhere(user) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: authorSelect },
      replies: {
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { author: { select: authorSelect } },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  const comments = page.reverse();

  // Same pattern GET /api/feed uses for posts: one groupBy for per-emoji
  // counts and one targeted query for this user's own reactions, across
  // every comment AND reply id in the page — not N+1 queries per comment.
  const commentIds: string[] = [];
  for (const c of comments) {
    commentIds.push(c.id);
    for (const r of c.replies) commentIds.push(r.id);
  }

  const [reactionCounts, myReactions] = await Promise.all([
    prisma.commentReaction.groupBy({
      by: ["commentId", "emoji"],
      where: { commentId: { in: commentIds } },
      _count: true,
    }),
    prisma.commentReaction.findMany({
      where: { commentId: { in: commentIds }, userId: user.id },
      select: { commentId: true, emoji: true },
    }),
  ]);

  const reactionMap = new Map<string, Record<string, number>>();
  for (const r of reactionCounts) {
    const m = reactionMap.get(r.commentId) ?? {};
    m[r.emoji] = r._count;
    reactionMap.set(r.commentId, m);
  }
  const myReactionMap = new Map<string, string[]>();
  for (const r of myReactions) {
    const arr = myReactionMap.get(r.commentId) ?? [];
    arr.push(r.emoji);
    myReactionMap.set(r.commentId, arr);
  }

  const data = comments.map((c) => ({
    id: c.id,
    content: c.content,
    commentType: c.commentType,
    gifProvider: c.gifProvider,
    gifId: c.gifId,
    createdAt: c.createdAt.toISOString(),
    authorId: c.authorId,
    author: { displayName: c.author.displayName, avatarUrl: c.author.avatarUrl },
    reactions: reactionMap.get(c.id) ?? {},
    myReactions: myReactionMap.get(c.id) ?? [],
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      commentType: r.commentType,
      gifProvider: r.gifProvider,
      gifId: r.gifId,
      createdAt: r.createdAt.toISOString(),
      authorId: r.authorId,
      author: { displayName: r.author.displayName, avatarUrl: r.author.avatarUrl },
      parentId: r.parentId,
      reactions: reactionMap.get(r.id) ?? {},
      myReactions: myReactionMap.get(r.id) ?? [],
    })),
  }));

  return NextResponse.json({ data, nextCursor });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { content, parentId, commentType, gifProvider, gifId } = parsed.data;

  // Both lookups are independent — run them concurrently, then apply the
  // same checks (post-not-found first, then invalid-parent) as before.
  //
  // The post lookup is department-scoped, matching GET /api/feed and the react
  // route. Without it any authenticated employee who knew a post id could
  // comment on a post they cannot see — and now that commenting notifies the
  // author, an unscoped lookup would also leak a department-only post's
  // existence through the notification it generates.
  //
  // Author ids are selected here because the notification fan-out below needs
  // them; keeping it in these two queries avoids a third round trip.
  const [post, parent] = await Promise.all([
    prisma.socialPost.findFirst({
      where: { id, ...postVisibilityWhere(user) },
      select: { id: true, authorId: true, departmentId: true },
    }),
    parentId
      ? prisma.socialComment.findUnique({
          where: { id: parentId },
          select: { postId: true, authorId: true },
        })
      : Promise.resolve(null),
  ]);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (parentId && (!parent || parent.postId !== id)) {
    return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
  }

  const comment = await prisma.socialComment.create({
    data: {
      postId: id,
      authorId: user.id,
      content: content?.trim() ? content.trim() : null,
      parentId: parentId ?? null,
      commentType,
      gifProvider: commentType === "GIF" ? gifProvider : null,
      gifId: commentType === "GIF" ? gifId : null,
    },
    include: { author: { select: authorSelect } },
  });

  // Notify the parent comment's author on a reply, otherwise the post's author.
  // Both are skipped when it is your own — replying to yourself or commenting
  // on your own post should be silent. When someone replies to a comment on
  // someone else's post, only the comment author is told: the post author gets
  // the top-level comment notification and does not need every sub-reply too.
  const preview = comment.content ? stripMentionTokens(comment.content).slice(0, 140) : "Sent a GIF";
  const recipientId = parent ? parent.authorId : post.authorId;

  // Anyone @mentioned in the comment body. Same validated path as post
  // mentions: ids come from the client inside `@[Name|uuid]` tokens, so each is
  // checked against a real active user and filtered by who can see this post.
  // Mentioned users are notified even if they are not the post or comment
  // author — being named is the point.
  void resolveMentionRecipients({
    content: comment.content,
    postDepartmentId: post.departmentId,
    authorId: user.id,
  })
    .then((mentioned) =>
      Promise.allSettled(
        mentioned
          // Skip anyone already getting the comment/reply notification below —
          // one message about the same comment is enough.
          .filter((m) => m.id !== recipientId)
          .map((m) =>
            createNotification({
              userId: m.id,
              type: "MENTION",
              title: `${user.displayName} mentioned you in a comment`,
              body: preview,
              data: { postId: id, commentId: comment.id },
            }),
          ),
      ),
    )
    .catch((err) => console.error("comment mention notifications failed", err));

  if (recipientId !== user.id) {
    void createNotification({
      userId: recipientId,
      type: parent ? "REPLY_TO_COMMENT" : "COMMENT_ON_POST",
      title: parent
        ? `${user.displayName} replied to your comment`
        : `${user.displayName} commented on your post`,
      body: preview,
      // postId drives the deep link; commentId keys the reply grouping.
      data: { postId: id, commentId: parentId ?? comment.id },
    }).catch((err) => console.error("comment notification failed", err));
  }

  scheduleBroadcast([{ topic: realtimeTopics.feed }]);

  return NextResponse.json({
    data: {
      id: comment.id,
      content: comment.content,
      commentType: comment.commentType,
      gifProvider: comment.gifProvider,
      gifId: comment.gifId,
      createdAt: comment.createdAt.toISOString(),
      authorId: comment.authorId,
      author: { displayName: comment.author.displayName, avatarUrl: comment.author.avatarUrl },
      parentId: comment.parentId ?? null,
      reactions: {},
      myReactions: [],
      replies: [],
    },
  }, { status: 201 });
}
