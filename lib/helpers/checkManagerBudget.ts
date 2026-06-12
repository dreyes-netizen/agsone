import { prisma } from "@/lib/prisma/client";
import { MANAGER_MONTHLY_BUDGET } from "@/lib/constants/awardActivities";

export type BudgetStatus = {
  allowed: boolean;
  isExempt: boolean;
  used: number;
  remaining: number;
  total: number;
};

/**
 * Manual §3: each manager gets 500 recognition points per month; unused points
 * do not roll over. HR_ADMIN is exempt. Only MANUAL_AWARD transactions count —
 * system-generated types (milestones, game wins) never touch the budget.
 *
 * Known limitation: two concurrent awards by the same manager can race past
 * the cap. Manual awards are infrequent enough that we accept this rather
 * than adding a lock table.
 */
export async function checkManagerBudget(
  actorId: string,
  actorRole: string,
  amountNeeded: number,
): Promise<BudgetStatus> {
  if (actorRole === "HR_ADMIN") {
    return { allowed: true, isExempt: true, used: 0, remaining: MANAGER_MONTHLY_BUDGET, total: MANAGER_MONTHLY_BUDGET };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await prisma.pointTransaction.aggregate({
    where: {
      fromUserId: actorId,
      type: "MANUAL_AWARD",
      createdAt: { gte: monthStart },
    },
    _sum: { amount: true },
  });

  const used = agg._sum.amount ?? 0;
  const remaining = Math.max(0, MANAGER_MONTHLY_BUDGET - used);

  return {
    allowed: amountNeeded <= remaining,
    isExempt: false,
    used,
    remaining,
    total: MANAGER_MONTHLY_BUDGET,
  };
}
