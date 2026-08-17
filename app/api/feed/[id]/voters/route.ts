import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
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
 * Who voted, and for which option — backs the poll voter-list modal. Modeled
 * directly on GET /api/feed/[id]/reactions: per-option counts across ALL
 * votes on the poll (so filter tabs stay correct regardless of the active
 * tab), plus a cursor-paginated page of voters, optionally narrowed to one
 * option. Anonymous polls refuse this entirely — including for the poll's
 * own author — since "anonymous" means anonymous to everyone, not just to
 * other voters.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const post = await prisma.socialPost.findFirst({
    where: { id, ...postVisibilityWhere(user) },
    select: {
      id: true,
      type: true,
      isAnonymous: true,
      pollOptions: { select: { id: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.type !== "POLL") return NextResponse.json({ error: "Post is not a poll" }, { status: 400 });
  if (post.isAnonymous) return NextResponse.json({ error: "This poll is anonymous" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const optionParam = searchParams.get("option");
  const optionFilter = post.pollOptions.some((o) => o.id === optionParam) ? optionParam : null;
  const cursor = searchParams.get("cursor") ?? undefined;
  const parsedLimit = parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_PAGE_SIZE)
    : PAGE_SIZE;

  const [countsRaw, votes] = await Promise.all([
    prisma.pollVote.groupBy({
      by: ["optionId"],
      where: { postId: id },
      _count: true,
    }),
    prisma.pollVote.findMany({
      where: { postId: id, ...(optionFilter ? { optionId: optionFilter } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: userSelect }, option: { select: { text: true } } },
    }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const c of countsRaw) {
    counts[c.optionId] = c._count;
    total += c._count;
  }

  const hasMore = votes.length > limit;
  const page = hasMore ? votes.slice(0, limit) : votes;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const voters = page.map((v) => ({
    id: v.id,
    optionId: v.optionId,
    optionText: v.option.text,
    createdAt: v.createdAt.toISOString(),
    isCurrentUser: v.userId === user.id,
    user: {
      id: v.user.id,
      displayName: v.user.displayName,
      avatarUrl: v.user.avatarUrl,
      department: v.user.department?.name ?? null,
    },
  }));

  return NextResponse.json({ data: { counts, total, voters }, nextCursor });
}
