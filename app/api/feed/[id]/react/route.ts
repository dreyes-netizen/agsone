import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({ emoji: z.string().min(1).max(10) });

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

  // Find any existing reaction from this user on this post (any emoji)
  const existing = await prisma.socialReaction.findFirst({
    where: { postId: id, userId: user.id },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      // Same emoji — toggle off
      await prisma.socialReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: "removed", emoji });
    } else {
      // Different emoji — swap
      await prisma.socialReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      return NextResponse.json({ action: "changed", emoji, previous: existing.emoji });
    }
  }

  await prisma.socialReaction.create({ data: { postId: id, userId: user.id, emoji } });
  return NextResponse.json({ action: "added", emoji });
}
