import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Bound the result set: this used to return EVERY active employee on each
  // feed-compose / minigame-invite. The two callers (feed + minigame pickers)
  // currently load the whole list and filter client-side, so we cap at a high
  // limit that won't truncate any realistic internal headcount rather than a
  // small page that would drop selectable names. ?q= is supported for a future
  // server-side typeahead that would let the cap come down.
  const q = new URL(req.url).searchParams.get("q")?.trim();

  const employees = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: user.id },
      ...(q ? { displayName: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { displayName: "asc" },
    take: 500,
    select: { id: true, displayName: true, avatarUrl: true },
  });

  return NextResponse.json({ data: employees });
}
