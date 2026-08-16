import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { GIF_PROVIDERS, GIF_ID_PATTERN } from "@/lib/constants/gif";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";
import { createNotification } from "@/lib/helpers/createNotification";
import { resolveMentionRecipients } from "@/lib/helpers/parseMentions";

const authorSelect = { id: true, displayName: true, avatarUrl: true };

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

  // The client renders this whole list with no "load more" affordance, so a
  // tight page size would silently hide real comments — these are generous
  // ceilings against a pathological case (a post with thousands of
  // comments), not real pagination.
  const comments = await prisma.socialComment.findMany({
    where: { postId: id, parentId: null },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: {
      author: { select: authorSelect },
      replies: {
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { author: { select: authorSelect } },
      },
    },
  });

  const data = comments.map((c) => ({
    id: c.id,
    content: c.content,
    commentType: c.commentType,
    gifProvider: c.gifProvider,
    gifId: c.gifId,
    createdAt: c.createdAt.toISOString(),
    authorId: c.authorId,
    author: { displayName: c.author.displayName, avatarUrl: c.author.avatarUrl },
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
    })),
  }));

  return NextResponse.json({ data });
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
  const preview = comment.content?.slice(0, 140) ?? "Sent a GIF";
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
      replies: [],
    },
  }, { status: 201 });
}
