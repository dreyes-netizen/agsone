import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

// Lightweight, searchable roster list for admin pickers (org chart node
// assignment/replacement, points-of-contact user select). Deliberately
// separate from /api/employees, which excludes the caller — a picker here
// must be able to select the logged-in HR admin themselves.
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();

  const employees = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(q ? { displayName: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { displayName: "asc" },
    take: 500,
    select: { id: true, displayName: true, email: true, avatarUrl: true, position: true },
  });

  return NextResponse.json({ data: employees });
}
