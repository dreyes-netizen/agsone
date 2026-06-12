import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { pointsReceivedEmail } from "@/lib/email/templates";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { broadcast } from "@/lib/realtime/broadcast";
import { findActivity } from "@/lib/constants/awardActivities";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read uploaded file" }, { status: 400 });
  }

  const file = formData.get("file");
  const attendanceMonth = formData.get("attendanceMonth") as string;

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!attendanceMonth) {
    return NextResponse.json({ error: "attendanceMonth is required" }, { status: 400 });
  }

  const monthStart = new Date(attendanceMonth);
  if (isNaN(monthStart.getTime())) {
    return NextResponse.json({ error: "Invalid attendanceMonth" }, { status: 400 });
  }
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const buffer = Buffer.from(await (file as File).arrayBuffer());

  // Dynamic import avoids ESM/CJS bundling issues with xlsx
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");

  let workbook: import("xlsx").WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return NextResponse.json({ error: "Could not parse Excel file — make sure it is a valid .xlsx file" }, { status: 400 });
  }

  const sheet = workbook.Sheets["Summary"];
  if (!sheet) {
    return NextResponse.json({ error: "Sheet 'Summary' not found — please upload a Sprout HR attendance report" }, { status: 400 });
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  // Perfect attendance: Days Present > 20, Days Absent = 0, Undertime = 0
  const perfectRows = rows.filter((r) => {
    const present  = Number(r["Days Present"]);
    const absent   = Number(r["Days Absent *"]);
    const undertime = Number(r["Undertime *"]);
    return present > 20 && absent === 0 && undertime === 0;
  });

  if (perfectRows.length === 0) {
    return NextResponse.json({ data: { awarded: 0, skipped: { notFound: [], alreadyAwarded: [] } } });
  }

  const employeeIds = perfectRows
    .map((r) => String(r["ID No"] ?? "").trim())
    .filter(Boolean);

  // Match Employee IDs to DB users
  const dbUsers = await prisma.user.findMany({
    where: { employeeId: { in: employeeIds }, isActive: true },
    select: { id: true, displayName: true, email: true, pointsBalance: true, employeeId: true },
  });
  const dbUserMap = new Map(dbUsers.map((u) => [u.employeeId!, u]));
  const notFound = employeeIds.filter((id) => !dbUserMap.has(id));
  const foundUserIds = dbUsers.map((u) => u.id);

  // Duplicate guard: skip users already awarded PERFECT_ATTENDANCE this month
  const alreadyAwardedTx = await prisma.pointTransaction.findMany({
    where: {
      toUserId: { in: foundUserIds },
      activity: "PERFECT_ATTENDANCE",
      createdAt: { gte: monthStart, lt: monthEnd },
    },
    select: { toUserId: true },
  });
  const alreadyAwardedSet = new Set(alreadyAwardedTx.map((t) => t.toUserId));

  const toAward = dbUsers.filter((u) => !alreadyAwardedSet.has(u.id));
  const alreadyAwardedNames = dbUsers
    .filter((u) => alreadyAwardedSet.has(u.id))
    .map((u) => u.displayName);

  if (toAward.length === 0) {
    return NextResponse.json({
      data: { awarded: 0, skipped: { notFound, alreadyAwarded: alreadyAwardedNames } },
    });
  }

  const activity = findActivity("PERFECT_ATTENDANCE")!;
  const amount = activity.points;
  const note = `Perfect attendance — ${monthStart.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
  const category = activity.category;
  const recipientIds = toAward.map((u) => u.id);

  await prisma.$transaction([
    prisma.pointTransaction.createMany({
      data: recipientIds.map((id) => ({
        fromUserId: user!.id,
        toUserId: id,
        amount,
        type: "MANUAL_AWARD",
        note,
        category,
        activity: "PERFECT_ATTENDANCE",
        createdById: user!.id,
      })),
    }),
    prisma.user.updateMany({
      where: { id: { in: recipientIds } },
      data: { pointsBalance: { increment: amount } },
    }),
  ]);

  // Re-fetch updated balances
  const updatedUsers = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, pointsBalance: true },
  });
  const balanceMap = new Map(updatedUsers.map((u) => [u.id, u.pointsBalance]));

  const actorUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { displayName: true },
  });
  const actorName = actorUser?.displayName ?? "Super Admin";

  // Per-user: notification + email + level-up + badges + broadcast
  for (const u of toAward) {
    const newBalance = balanceMap.get(u.id) ?? (u.pointsBalance + amount);
    createNotification({
      userId: u.id,
      type: "POINTS_RECEIVED",
      title: `You received ${amount} points!`,
      body: note,
      data: { amount, fromUserId: user!.id },
    }).catch(() => {});
    sendMail({
      to: u.email,
      ...pointsReceivedEmail(u.displayName, amount, actorName, note, newBalance),
    }).catch(() => {});
    checkLevelUp(u.id, newBalance).catch(() => {});
    prisma.pointTransaction
      .aggregate({ where: { toUserId: u.id, amount: { gt: 0 } }, _sum: { amount: true } })
      .then((agg) => checkAndAwardBadges({ userId: u.id, totalEarned: agg._sum.amount ?? 0 }))
      .catch(() => {});
    broadcast(`points:${u.id}`).catch(() => {});
  }

  prisma.auditLog.create({
    data: {
      actorId: user!.id,
      action: "ATTENDANCE_AWARD",
      entityType: "PointTransaction",
      entityId: user!.id,
      afterState: { attendanceMonth, recipientIds, amount, count: recipientIds.length, notFound },
    },
  }).catch(() => {});

  return NextResponse.json({
    data: {
      awarded: toAward.length,
      awardedNames: toAward.map((u) => u.displayName),
      skipped: { notFound, alreadyAwarded: alreadyAwardedNames },
    },
  });
}
