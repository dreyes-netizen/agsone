import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      pointsBalance: true,
      isActive: true,
      hireDate: true,
      birthday: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: employees });
}
