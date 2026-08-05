import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { createNotification } from "@/lib/helpers/createNotification";
import { sendMail } from "@/lib/email/mailer";
import { pointsDeductedEmail } from "@/lib/email/templates";
import { broadcast } from "@/lib/realtime/broadcast";
import { VIOLATION_TYPES } from "@/lib/constants/awardActivities";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { z } from "zod";

const violationKeys = VIOLATION_TYPES.map((v) => v.key) as [string, ...string[]];

const schema = z
  .object({
    toUserId: z.string().uuid(),
    violationType: z.enum([...violationKeys, "CUSTOM"] as [string, ...string[]]),
    customAmount: z.number().int().min(1).max(1000).optional(),
    reason: z.string().min(1).max(500),
  })
  .refine((d) => d.violationType !== "CUSTOM" || d.customAmount !== undefined, {
    message: "customAmount is required when violationType is CUSTOM",
    path: ["customAmount"],
  });

export async function POST(req: NextRequest) {
  const actor = await verifyAuth(req);
  if (!requireRole(actor, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(actor!.id, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { toUserId, violationType, customAmount, reason } = parsed.data;

  const requested =
    violationType === "CUSTOM"
      ? customAmount!
      : VIOLATION_TYPES.find((v) => v.key === violationType)!.points;

  // The floor-at-zero clamp (deducted = min(requested, balance)) must be
  // computed from the same locked read the UPDATE writes from, not a
  // findUnique() taken before the transaction's write — otherwise two
  // concurrent deductions can each clamp against the same stale balance,
  // and the second UPDATE still applies its full (stale-computed) amount
  // on top of the first, pushing the balance negative. FOR UPDATE + a
  // single statement makes the read-clamp-write atomic.
  let result: { deducted: number; newBalance: number; toUserName: string | null };
  try {
    result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ newBalance: number; oldBalance: number; toUserName: string | null }[]>`
        WITH old AS (
          SELECT "pointsBalance" AS balance, "displayName" FROM "User" WHERE id = ${toUserId} FOR UPDATE
        )
        UPDATE "User" AS u
        SET "pointsBalance" = GREATEST(old.balance - ${requested}::int, 0)
        FROM old
        WHERE u.id = ${toUserId}
        RETURNING u."pointsBalance" AS "newBalance", old.balance AS "oldBalance", old."displayName" AS "toUserName"
      `;
      if (rows.length === 0) throw new Error("NOT_FOUND");
      const { newBalance, oldBalance, toUserName } = rows[0];
      if (oldBalance <= 0) throw new Error("ZERO_BALANCE");
      const deducted = oldBalance - newBalance;

      await tx.pointTransaction.create({
        data: {
          fromUserId: actor!.id,
          toUserId,
          amount: -deducted,
          type: "DEDUCTION",
          note: reason,
          createdById: actor!.id,
        },
      });
      return { deducted, newBalance, toUserName };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "ZERO_BALANCE") {
      return NextResponse.json({ error: "Employee already has zero points balance." }, { status: 400 });
    }
    throw err;
  }

  // Fire-and-forget: notification + realtime balance refresh + email
  const recipient = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { email: true, displayName: true },
  });

  createNotification({
    userId: toUserId,
    type: "POINTS_DEDUCTED",
    title: `${result.deducted.toLocaleString()} points were deducted`,
    body: reason,
    data: { amount: result.deducted, violationType },
  }).catch(() => {});

  broadcast(`points:${toUserId}`).catch(() => {});

  if (recipient?.email && recipient.displayName) {
    sendMail({
      to: recipient.email,
      ...pointsDeductedEmail(recipient.displayName, result.deducted, reason, result.newBalance),
    }).catch(() => {});
  }

  await prisma.auditLog.create({
    data: {
      actorId: actor!.id,
      action: "DEDUCT_POINTS",
      entityType: "PointTransaction",
      entityId: toUserId,
      afterState: { toUserId, toUserName: result.toUserName, violationType, deducted: result.deducted, reason, newBalance: result.newBalance },
    },
  });

  return NextResponse.json({
    data: { requested, deducted: result.deducted, newBalance: result.newBalance },
  });
}
