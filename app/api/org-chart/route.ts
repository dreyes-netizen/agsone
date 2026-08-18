import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

// A user is "in the org chart" once HR gives them a position — no separate
// membership table. Hierarchy comes from the existing User.managerId chain.
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nodes = await prisma.user.findMany({
    where: { position: { not: null }, isActive: true },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      position: true,
      managerId: true,
      orgChartHighlight: true,
      orgChartDashed: true,
    },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ data: nodes });
}
