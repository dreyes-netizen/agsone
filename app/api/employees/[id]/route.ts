import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      role: true,
      pointsBalance: true,
      level: true,
      streakDays: true,
      birthday: true,
      hireDate: true,
      isActive: true,
      department: { select: { id: true, name: true } },
      userBadges: {
        orderBy: { awardedAt: "desc" },
        select: {
          id: true,
          awardedAt: true,
          badge: { select: { name: true, description: true, iconUrl: true } },
        },
      },
    },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rank = await prisma.user.count({
    where: { pointsBalance: { gt: employee.pointsBalance }, isActive: true },
  }) + 1;

  return NextResponse.json({ data: { ...employee, rank } });
}
