import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await prisma.pointOfContact.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      position: true,
      description: true,
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ data: contacts });
}
