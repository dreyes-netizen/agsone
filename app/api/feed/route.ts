import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  try {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const cursor     = searchParams.get("cursor") ?? undefined;

  const posts = await prisma.socialPost.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: typeFilter ? { type: typeFilter as never } : undefined,
    include: {
      author: { select: { displayName: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      _count: { select: { comments: true } },
      pollOptions: { include: { _count: { select: { votes: true } } } },
    },
  });

  const hasMore   = posts.length > PAGE_SIZE;
  const page      = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
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
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
  z.object({
    type: z.literal("POLL"),
    content: z.string().min(1).max(1000),
    options: z.array(z.string().min(1).max(200)).min(2).max(4),
    imageUrls: z.array(z.string().url()).max(4).optional(),
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

  const post = await prisma.socialPost.create({
    data: {
      authorId: user.id,
      content: parsed.data.content,
      type: parsed.data.type,
      imageUrls: parsed.data.imageUrls ?? [],
    },
    include: { author: { select: { displayName: true, avatarUrl: true } } },
  });

  return NextResponse.json({ data: { ...post, pollOptions: [], myVoteOptionId: null } }, { status: 201 });
}
