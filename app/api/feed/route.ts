import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { createNotification } from "@/lib/helpers/createNotification";
import { FLAIR_IDS } from "@/lib/flairs";

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  try {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const cursor     = searchParams.get("cursor") ?? undefined;
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10), PAGE_SIZE);

  const posts = await prisma.socialPost.findMany({
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: typeFilter ? { type: typeFilter as never } : undefined,
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true } },
      recipient: { select: { id: true, displayName: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      _count: { select: { comments: true } },
      pollOptions: { include: { _count: { select: { votes: true } } } },
    },
  });

  const hasMore   = posts.length > limit;
  const page      = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const myVotes = await prisma.pollVote.findMany({
    where: { userId: user.id, postId: { in: page.map((p) => p.id) } },
    select: { postId: true, optionId: true },
  });
  const myVoteMap = new Map(myVotes.map((v) => [v.postId, v.optionId]));

  const enriched = page.map((p) => {
    const reactionMap: Record<string, number> = {};
    for (const r of p.reactions) {
      reactionMap[r.emoji] = (reactionMap[r.emoji] ?? 0) + 1;
    }
    const myReactions = p.reactions.filter((r) => r.userId === user.id).map((r) => r.emoji);
    // Back-compat: fold legacy imageUrl into imageUrls so old posts still show their photo
    const imageUrls = p.imageUrls.length > 0 ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];
    return {
      ...p,
      imageUrls,
      reactions: reactionMap,
      myReactions,
      commentCount: p._count.comments,
      myVoteOptionId: myVoteMap.get(p.id) ?? null,
    };
  });

  return NextResponse.json({ data: enriched, nextCursor });
  } catch (err) {
    console.error("[GET /api/feed]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["UPDATE", "ACHIEVEMENT", "CELEBRATION", "ANNOUNCEMENT"]),
    content: z.string().min(1).max(1000),
    flair: z.enum(FLAIR_IDS),
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
  z.object({
    type: z.literal("POLL"),
    content: z.string().min(1).max(1000),
    flair: z.enum(FLAIR_IDS),
    options: z.array(z.string().min(1).max(200)).min(2).max(4),
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
  z.object({
    type: z.literal("SHOUTOUT"),
    content: z.string().min(1).max(500),
    recipientId: z.string().uuid(),
  }),
]);

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.type === "POLL") {
    const post = await prisma.socialPost.create({
      data: {
        authorId: user.id,
        content: parsed.data.content,
        type: "POLL",
        flair: parsed.data.flair,
        imageUrls: parsed.data.imageUrls ?? [],
        pollOptions: {
          create: parsed.data.options.map((text) => ({ text })),
        },
      },
      include: {
        author: { select: { displayName: true, avatarUrl: true } },
        pollOptions: { include: { _count: { select: { votes: true } } } },
      },
    });
    return NextResponse.json({ data: { ...post, myVoteOptionId: null } }, { status: 201 });
  }

  if (parsed.data.type === "SHOUTOUT") {
    if (parsed.data.recipientId === user.id) {
      return NextResponse.json({ error: "Cannot shoutout yourself" }, { status: 400 });
    }
    const post = await prisma.socialPost.create({
      data: {
        authorId: user.id,
        content: parsed.data.content,
        type: "SHOUTOUT",
        flair: "RECOGNITION",
        imageUrls: [],
        recipientId: parsed.data.recipientId,
      },
      include: {
        author: { select: { displayName: true, avatarUrl: true } },
        recipient: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    createNotification({
      userId: parsed.data.recipientId,
      type: "SHOUTOUT_RECEIVED",
      title: `${user.displayName} gave you a shoutout!`,
      body: parsed.data.content.slice(0, 100),
      data: { postId: post.id },
    });
    return NextResponse.json({ data: { ...post, pollOptions: [], myVoteOptionId: null } }, { status: 201 });
  }

  const post = await prisma.socialPost.create({
    data: {
      authorId: user.id,
      content: parsed.data.content,
      type: parsed.data.type,
      flair: parsed.data.flair,
      imageUrls: parsed.data.imageUrls ?? [],
    },
    include: { author: { select: { displayName: true, avatarUrl: true } } },
  });

  return NextResponse.json({ data: { ...post, pollOptions: [], myVoteOptionId: null } }, { status: 201 });
}
