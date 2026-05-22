import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { createNotification } from "@/lib/helpers/createNotification";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth(req);
  if (!requireRole(authUser, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action, adminNote } = await req.json();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  if (action === "reject" && !adminNote?.trim()) {
    return NextResponse.json({ error: "adminNote is required when rejecting" }, { status: 400 });
  }

  const completion = await prisma.missionCompletion.findUnique({
    where: { id },
    include: { mission: true },
  });
  if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (completion.status !== "PENDING") {
    return NextResponse.json({ error: "Already processed" }, { status: 409 });
  }

  if (action === "approve") {
    // Read the updated balance from the transaction result to avoid a stale pre-fetch
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.missionCompletion.update({
        where: { id },
        data: { status: "APPROVED", verifiedById: authUser!.id, verifiedAt: new Date() },
      });
      await tx.pointTransaction.create({
        data: {
          toUserId: completion.userId,
          fromUserId: authUser!.id,
          amount: completion.mission.pointsReward,
          type: "TASK",
          note: completion.mission.title,
          createdById: authUser!.id,
          sourceReferenceId: completion.id,
        },
      });
      return tx.user.update({
        where: { id: completion.userId },
        data: { pointsBalance: { increment: completion.mission.pointsReward } },
        select: { pointsBalance: true },
      });
    });

    // Notification and audit log are independent — run in parallel
    await Promise.all([
      createNotification({
        userId: completion.userId,
        type: "MISSION_APPROVED",
        title: "Mission approved",
        body: `'${completion.mission.title}' — +${completion.mission.pointsReward} pts`,
      }),
      prisma.auditLog.create({
        data: {
          actorId: authUser!.id,
          action: "APPROVE_MISSION",
          entityType: "MissionCompletion",
          entityId: id,
          afterState: { missionId: completion.missionId, userId: completion.userId, pointsAwarded: completion.mission.pointsReward },
        },
      }),
    ]);

    // Fire-and-forget background checks using the confirmed post-transaction balance
    prisma.pointTransaction
      .aggregate({ where: { toUserId: completion.userId, amount: { gt: 0 } }, _sum: { amount: true } })
      .then((agg) => checkAndAwardBadges({ userId: completion.userId, totalEarned: agg._sum.amount ?? 0 }))
      .catch(() => {});
    checkLevelUp(completion.userId, updatedUser.pointsBalance).catch(() => {});
  } else {
    await prisma.missionCompletion.update({
      where: { id },
      data: {
        status: "REJECTED",
        adminNote: adminNote.trim(),
        verifiedById: authUser!.id,
        verifiedAt: new Date(),
      },
    });

    // Notification and audit log are independent — run in parallel
    await Promise.all([
      createNotification({
        userId: completion.userId,
        type: "MISSION_REJECTED",
        title: "Mission not approved",
        body: `'${completion.mission.title}' — ${adminNote.trim()}`,
      }),
      prisma.auditLog.create({
        data: {
          actorId: authUser!.id,
          action: "REJECT_MISSION",
          entityType: "MissionCompletion",
          entityId: id,
          afterState: { missionId: completion.missionId, userId: completion.userId, adminNote: adminNote.trim() },
        },
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
