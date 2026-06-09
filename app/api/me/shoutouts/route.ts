import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shoutouts = await prisma.shoutoutRecipient.findMany({
    where: { userId: user.id },
    include: {
      post: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { post: { createdAt: "desc" } },
    take: 5,
  });

  return NextResponse.json({ data: shoutouts });
}
