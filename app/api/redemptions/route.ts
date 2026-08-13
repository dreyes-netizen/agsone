import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  // Admins see all; employees see only their own
  const where = user.role === "EMPLOYEE" ? { userId: user.id } : {};

  const [redemptions, total] = await Promise.all([
    prisma.redemption.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        reward: { select: { name: true, pointCost: true, category: true } },
        user: { select: { displayName: true, email: true } },
        processedBy: { select: { displayName: true } },
      },
    }),
    prisma.redemption.count({ where }),
  ]);

  return NextResponse.json(paginatedResponse(redemptions, total, page, limit));
}

const createSchema = z.object({
  rewardId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(user.id, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reward = await prisma.reward.findUnique({
    where: { id: parsed.data.rewardId, isActive: true },
  });

  if (!reward) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  // Atomic: deduct points + create redemption + decrement stock.
  // The balance guard used to be a separate `if` check before this
  // transaction, reading `user.pointsBalance` from the verifyAuth payload —
  // that value can be stale by the time the transaction runs, so two
  // concurrent redemptions could both pass the check and both decrement,
  // driving the balance negative. Guarding with `updateMany({ where: {
  // pointsBalance: { gte: cost } } })` mirrors the stock check just below:
  // Postgres evaluates the WHERE clause against the row's current value at
  // update time and locks it for the duration, so a second concurrent
  // request sees the already-decremented balance and its guard fails —
  // unlike a plain SELECT-then-UPDATE, which has no such lock and is
  // exactly the race that made this exploitable.
  let redemption;
  try {
    redemption = await prisma.$transaction(async (tx) => {
      const balanceResult = await tx.user.updateMany({
        where: { id: user.id, pointsBalance: { gte: reward.pointCost } },
        data: { pointsBalance: { decrement: reward.pointCost } },
      });
      if (balanceResult.count === 0) {
        throw new Error("INSUFFICIENT_POINTS");
      }
      const created = await tx.redemption.create({
        data: { userId: user.id, rewardId: reward.id, pointsSpent: reward.pointCost, status: "PENDING" },
      });
      await tx.pointTransaction.create({
        data: { toUserId: user.id, amount: -reward.pointCost, type: "REDEMPTION", note: `Redeemed: ${reward.name}`, createdById: user.id },
      });
      const stockResult = await tx.reward.updateMany({
        where: { id: reward.id, OR: [{ stockQuantity: -1 }, { stockQuantity: { gt: 0 } }] },
        data: reward.stockQuantity === -1 ? {} : { stockQuantity: { decrement: 1 } },
      });
      if (stockResult.count === 0) {
        throw new Error("OUT_OF_STOCK");
      }
      return created;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_POINTS") {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
    }
    if (err instanceof Error && err.message === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Out of stock" }, { status: 400 });
    }
    throw err;
  }

  scheduleBroadcast([
    { topic: realtimeTopics.profile(user.id) },
    { topic: realtimeTopics.pointsTransactions },
    { topic: realtimeTopics.leaderboard },
    { topic: realtimeTopics.rewards },
    { topic: realtimeTopics.redemptionsUser(user.id) },
    { topic: realtimeTopics.redemptionsAdmin },
    { topic: realtimeTopics.adminAnalytics },
  ]);

  return NextResponse.json({ data: redemption }, { status: 201 });
}
