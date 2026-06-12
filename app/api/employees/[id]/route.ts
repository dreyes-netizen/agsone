import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await verifyAuth(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const isPrivileged = authUser && (authUser.role === 'HR_ADMIN' || authUser.role === 'MANAGER');

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
      birthday: true,
      hireDate: true,
      isActive: true,
      department: { select: { id: true, name: true } },
      bio: true,
      skills: true,
      userBadges: {
        orderBy: { awardedAt: "desc" },
        select: {
          id: true,
          awardedAt: true,
          badge: { select: { name: true, description: true, iconUrl: true } },
        },
      },
      shoutoutsReceived: {
        orderBy: { post: { createdAt: "desc" } },
        take: 6,
        include: {
          post: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              imageUrls: true,
              author: { select: { id: true, displayName: true, avatarUrl: true, department: { select: { name: true } } } },
              shoutoutRecipients: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
            },
          },
        },
      },
    },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rank = await prisma.user.count({
    where: { pointsBalance: { gt: employee.pointsBalance }, isActive: true },
  }) + 1;

  const { email, birthday, ...publicFields } = employee;
  const responseData = isPrivileged
    ? { ...employee, rank }
    : { ...publicFields, rank };

  return NextResponse.json({ data: responseData });
}
