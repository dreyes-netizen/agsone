import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { REACTION_EMOJIS } from "@/lib/constants/reactions";
import { postVisibilityWhere } from "@/lib/helpers/postVisibility";

const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

const userSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  department: { select: { name: true } },
};

/**
 * Who reacted, and with what — backs the reaction-details modal.
 *
 * Two things are fetched: per-emoji counts across ALL reactions on the post
 * (so the filter tabs always show correct totals regardless of which tab is
 * active), and a cursor-paginated page of reactors, optionally narrowed to
 * one emoji. Ordered most-recent-first; the current user's own reaction (if
 * any) is flagged via `isCurrentUser` so the client can highlight it
 * wherever it falls rather than force it to the literal top, which would
 * otherwise require excluding it on every subsequent page to avoid it
 * reappearing as a duplicate — not worth the complexity here.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Same department-visibility scoping as GET /api/feed: a user who can't
  // see a post in their feed must not be able to pull its reactor list by
  // guessing/knowing the post id directly.
  const post = await prisma.socialPost.findFirst({
    where: { id, ...postVisibilityWhere(user) },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const emojiParam = searchParams.get("emoji");
  const emojiFilter = REACTION_EMOJIS.includes(emojiParam as (typeof REACTION_EMOJIS)[number])
    ? emojiParam
    : null;
  const cursor = searchParams.get("cursor") ?? undefined;
  const parsedLimit = parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_PAGE_SIZE)
    : PAGE_SIZE;

  const [countsRaw, reactions] = await Promise.all([
    prisma.socialReaction.groupBy({
      by: ["emoji"],
      where: { postId: id },
      _count: true,
    }),
    prisma.socialReaction.findMany({
      where: { postId: id, ...(emojiFilter ? { emoji: emojiFilter } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: userSelect } },
    }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const c of countsRaw) {
    counts[c.emoji] = c._count;
    total += c._count;
  }

  const hasMore = reactions.length > limit;
  const page = hasMore ? reactions.slice(0, limit) : reactions;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const reactors = page.map((r) => ({
    id: r.id,
    emoji: r.emoji,
    createdAt: r.createdAt.toISOString(),
    isCurrentUser: r.userId === user.id,
    user: {
      id: r.user.id,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      department: r.user.department?.name ?? null,
    },
  }));

  return NextResponse.json({ data: { counts, total, reactors }, nextCursor });
}
