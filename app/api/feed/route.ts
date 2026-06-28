import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { createNotification } from "@/lib/helpers/createNotification";
import { broadcast } from "@/lib/realtime/broadcast";
import { FLAIR_IDS } from "@/lib/flairs";

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  try {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const POST_TYPES = ["UPDATE", "ACHIEVEMENT", "CELEBRATION", "ANNOUNCEMENT", "POLL", "SHOUTOUT"] as const;
  const rawType    = searchParams.get("type");
  // Validate against the enum: an unknown ?type= used to be cast `as never` and
  // passed straight to Prisma → a 500. Ignore invalid values instead.
  const typeFilter = POST_TYPES.includes(rawType as (typeof POST_TYPES)[number]) ? rawType : null;
  const deptFilter = searchParams.get("dept");
  const cursor     = searchParams.get("cursor") ?? undefined;
  // Guard against NaN / negative limits (e.g. ?limit=abc → take: NaN, ?limit=-5 → reverse paging).
  const parsedLimit = parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10);
  const limit      = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), PAGE_SIZE) : PAGE_SIZE;

  const visibilityWhere = user.role === "HR_ADMIN"
    ? {}
    : { OR: [{ departmentId: null }, { departmentId: user.departmentId }] };
  const typeWhere = typeFilter ? { type: typeFilter as (typeof POST_TYPES)[number] } : {};
  const deptWhere = (deptFilter === "mine" && user.departmentId)
    ? { departmentId: user.departmentId }
    : {};

  const posts = await prisma.socialPost.findMany({
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: { ...visibilityWhere, ...typeWhere, ...deptWhere },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } } },
      shoutoutRecipients: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      department: { select: { name: true } },
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["UPDATE", "ACHIEVEMENT", "CELEBRATION", "ANNOUNCEMENT"]),
    title: z.string().min(1).max(120),
    content: z.string().min(1).max(1000),
    flair: z.enum(FLAIR_IDS),
    imageUrls: z.array(z.string().url()).max(4).optional(),
    deptOnly: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("POLL"),
    title: z.string().min(1).max(120),
    content: z.string().min(1).max(1000),
    flair: z.enum(FLAIR_IDS),
    options: z.array(z.string().min(1).max(200)).min(2).max(4),
    imageUrls: z.array(z.string().url()).max(4).optional(),
    deptOnly: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("SHOUTOUT"),
    title: z.string().max(120).optional(),
    content: z.string().min(1).max(500),
    recipientIds: z.array(z.string().uuid()).min(1).max(10),
    imageUrls: z.array(z.string().url()).max(4).optional(),
    deptOnly: z.boolean().optional(),
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
        title: parsed.data.title,
        content: parsed.data.content,
        type: "POLL",
        flair: parsed.data.flair,
        imageUrls: parsed.data.imageUrls ?? [],
        departmentId: parsed.data.deptOnly ? user.departmentId : null,
        pollOptions: {
          create: parsed.data.options.map((text) => ({ text })),
        },
      },
      include: {
        author: { select: { displayName: true, avatarUrl: true } },
        pollOptions: { include: { _count: { select: { votes: true } } } },
      },
    });
    broadcast("feed").catch(() => {});
    return NextResponse.json({ data: { ...post, myVoteOptionId: null } }, { status: 201 });
  }

  if (parsed.data.type === "SHOUTOUT") {
    if (parsed.data.recipientIds.includes(user.id)) {
      return NextResponse.json({ error: "Cannot shoutout yourself" }, { status: 400 });
    }
    const post = await prisma.socialPost.create({
      data: {
        authorId: user.id,
        title: parsed.data.title ?? null,
        content: parsed.data.content,
        type: "SHOUTOUT",
        flair: "RECOGNITION",
        imageUrls: parsed.data.imageUrls ?? [],
        departmentId: parsed.data.deptOnly ? user.departmentId : null,
        shoutoutRecipients: {
          create: parsed.data.recipientIds.map((userId) => ({ userId })),
        },
      },
      include: {
        author: { select: { displayName: true, avatarUrl: true } },
        shoutoutRecipients: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });
    // createNotification is async (DB insert + realtime broadcast). Awaiting
    // allSettled prevents unhandled rejections and matches the fire-and-forget
    // convention used elsewhere (a failed notification can't break the post).
    await Promise.allSettled(
      parsed.data.recipientIds.map((recipientId) =>
        createNotification({
          userId: recipientId,
          type: "SHOUTOUT_RECEIVED",
          title: `${user.displayName} gave you a shoutout!`,
          body: parsed.data.content.slice(0, 100),
          data: { postId: post.id },
        })
      )
    );
    broadcast("feed").catch(() => {});
    return NextResponse.json({ data: { ...post, pollOptions: [], myVoteOptionId: null } }, { status: 201 });
  }

  const post = await prisma.socialPost.create({
    data: {
      authorId: user.id,
      title: parsed.data.title ?? null,
      content: parsed.data.content,
      type: parsed.data.type,
      flair: parsed.data.flair,
      imageUrls: parsed.data.imageUrls ?? [],
      departmentId: parsed.data.deptOnly ? user.departmentId : null,
    },
    include: { author: { select: { displayName: true, avatarUrl: true } } },
  });

  broadcast("feed").catch(() => {});
  return NextResponse.json({ data: { ...post, pollOptions: [], myVoteOptionId: null } }, { status: 201 });
}
