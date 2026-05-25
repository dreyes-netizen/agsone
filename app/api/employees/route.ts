import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employees = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  return NextResponse.json({ data: employees });
}
