import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const isAdmin = user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MANAGER";

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: isAdmin
        ? [
            { displayName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ]
        : [{ displayName: { contains: q, mode: "insensitive" } }],
    },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      department: { select: { id: true, name: true } },
      // role and email only returned to privileged callers
      ...(isAdmin ? { role: true, email: true } : {}),
    },
    orderBy: { displayName: "asc" },
    take: 10,
  });

  return NextResponse.json({ data: users });
}
