import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? user.id;

  // Employees can only view their own history; managers/admins can view anyone's
  if (userId !== user.id && user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transactions = await prisma.pointTransaction.findMany({
    where: { toUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      fromUser: { select: { displayName: true, avatarUrl: true } },
      createdBy: { select: { displayName: true } },
    },
  });

  return NextResponse.json({ data: transactions });
}
