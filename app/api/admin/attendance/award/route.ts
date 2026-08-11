import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { pointsReceivedEmail } from "@/lib/email/templates";
import { checkAndAwardBadges } from "@/lib/helpers/checkAndAwardBadges";
import { checkLevelUp } from "@/lib/helpers/checkLevelUp";
import { broadcast } from "@/lib/realtime/broadcast";
import { findActivity } from "@/lib/constants/awardActivities";

function cellToValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && "hyperlink" in value) {
      return value.text;
    }
    if ("formula" in value) {
      const result = value.result;
      if (result && typeof result === "object" && "error" in result) return null;
      return result ?? null;
    }
    if ("error" in value) return null;
    return null;
  }
  return value;
}

// Mirrors xlsx's `sheet_to_json(sheet, { defval: null })`: row 1 supplies the
// column headers, every subsequent non-blank row becomes an object keyed by
// those headers, and cells with no value default to null instead of being
// omitted.
function worksheetToJson(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headers: (string | null)[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cellToValue(cell.value);
    headers[colNumber] = value === null ? null : String(value).trim();
  });

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      record[header] = cellToValue(row.getCell(colNumber).value);
    });
    rows.push(record);
  });
  return rows;
}

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

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's own type defs shadow the global `Buffer` with a bare
    // `extends ArrayBuffer {}` interface, which a real Node Buffer doesn't
    // structurally satisfy under recent @types/node — cast to unblock;
    // exceljs's runtime `load()` still receives our actual Buffer.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return NextResponse.json({ error: "Could not parse Excel file — make sure it is a valid .xlsx file" }, { status: 400 });
  }

  const sheet = workbook.getWorksheet("Summary");
  if (!sheet) {
    return NextResponse.json({ error: "Sheet 'Summary' not found — please upload a Sprout HR attendance report" }, { status: 400 });
  }

  const rows = worksheetToJson(sheet);

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

  // user.displayName is already known from verifyAuth — no need to re-query it.
  const actorName = user!.displayName ?? "Super Admin";

  // Badge-checking needs each recipient's lifetime points earned — one
  // groupBy across all recipients instead of one aggregate() per recipient
  // (this used to be `toAward.length` separate aggregate queries).
  const earnedTotals = await prisma.pointTransaction.groupBy({
    by: ["toUserId"],
    where: { toUserId: { in: recipientIds }, amount: { gt: 0 } },
    _sum: { amount: true },
  });
  const earnedMap = new Map(earnedTotals.map((e) => [e.toUserId, e._sum.amount ?? 0]));

  // Per-user: notification + email + level-up + badges + broadcast
  for (const u of toAward) {
    const newBalance = balanceMap.get(u.id) ?? (u.pointsBalance + amount);
    createNotification({
      userId: u.id,
      type: "POINTS_RECEIVED",
      title: `You received ${amount} points!`,
      body: note,
      data: { amount, fromUserId: user!.id },
    }).catch((err) => console.error("points-received notification failed", err));
    sendMail({
      to: u.email,
      ...pointsReceivedEmail(u.displayName, amount, actorName, note, newBalance),
    }).catch((err) => console.error("points-received email failed", err));
    checkLevelUp(u.id, newBalance).catch((err) => console.error("checkLevelUp failed", err));
    checkAndAwardBadges({ userId: u.id, totalEarned: earnedMap.get(u.id) ?? 0 }).catch((err) => console.error("checkAndAwardBadges failed", err));
    broadcast(`points:${u.id}`).catch((err) => console.error("attendance award broadcast failed", err));
  }

  prisma.auditLog.create({
    data: {
      actorId: user!.id,
      action: "ATTENDANCE_AWARD",
      entityType: "PointTransaction",
      entityId: user!.id,
      afterState: { attendanceMonth, recipientIds, amount, count: recipientIds.length, notFound },
    },
  }).catch((err) => console.error("attendance award audit log write failed", err));

  return NextResponse.json({
    data: {
      awarded: toAward.length,
      awardedNames: toAward.map((u) => u.displayName),
      skipped: { notFound, alreadyAwarded: alreadyAwardedNames },
    },
  });
}
