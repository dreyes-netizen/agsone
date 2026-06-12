import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { checkManagerBudget } from "@/lib/helpers/checkManagerBudget";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["MANAGER", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const budget = await checkManagerBudget(user!.id, user!.role, 0);
  return NextResponse.json({
    data: {
      isExempt: budget.isExempt,
      used: budget.used,
      remaining: budget.remaining,
      total: budget.total,
    },
  });
}
