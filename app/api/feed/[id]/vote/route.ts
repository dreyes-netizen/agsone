import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

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

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: { type: true, pollOptions: { select: { id: true } } },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.type !== "POLL") return NextResponse.json({ error: "Post is not a poll" }, { status: 400 });

  const validOption = post.pollOptions.some((o) => o.id === parsed.data.optionId);
  if (!validOption) return NextResponse.json({ error: "Invalid option" }, { status: 400 });

  await prisma.pollVote.upsert({
    where: { postId_userId: { postId: id, userId: user.id } },
    update: { optionId: parsed.data.optionId },
    create: { postId: id, optionId: parsed.data.optionId, userId: user.id },
  });

  const pollOptions = await prisma.pollOption.findMany({
    where: { postId: id },
    select: { id: true, text: true, _count: { select: { votes: true } } },
  });

  return NextResponse.json({ data: { pollOptions, myVoteOptionId: parsed.data.optionId } });
}
