import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

async function computeProgress(
  metric: string,
  deptId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (metric === "TOTAL_POINTS") {
    const result = await prisma.pointTransaction.aggregate({
      where: {
        toUser: { departmentId: deptId },
        createdAt: { gte: startDate, lte: endDate },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  if (metric === "MISSIONS_COMPLETED") {
    return prisma.missionCompletion.count({
      where: {
        user: { departmentId: deptId },
        completedAt: { gte: startDate, lte: endDate },
        status: "APPROVED",
      },
    });
  }

  if (metric === "SHOUTOUTS_SENT") {
    return prisma.socialPost.count({
      where: {
        author: { departmentId: deptId },
        type: "SHOUTOUT",
        createdAt: { gte: startDate, lte: endDate },
      },
    });
  }

  return 0;
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  const [challenges, departments] = await Promise.all([
    prisma.challenge.findMany({
      where: { isActive: true, endDate: { gte: now } },
      orderBy: { startDate: "asc" },
    }),
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const result = await Promise.all(
    challenges.map(async (challenge) => {
      const deptProgress = await Promise.all(
        departments.map(async (dept) => {
          const progress = await computeProgress(
            challenge.metric,
            dept.id,
            challenge.startDate,
            challenge.endDate
          );
          return { deptId: dept.id, deptName: dept.name, progress };
        })
      );

      deptProgress.sort((a, b) => b.progress - a.progress);

      return {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        metric: challenge.metric,
        targetValue: challenge.targetValue,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        deptProgress,
      };
    })
  );

  return NextResponse.json({ data: result });
}
