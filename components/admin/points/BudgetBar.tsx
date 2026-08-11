"use client";

import type { Budget } from "@/lib/hooks/useAdminPointsActions";

export function BudgetBar({ budget }: { budget: Budget | null }) {
  if (!budget || budget.isExempt) return null;
  const pct = Math.min(100, (budget.used / budget.total) * 100);
  const barColor = budget.remaining === 0 ? "bg-red-500" : budget.remaining < 100 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mb-4 bg-gray-50 border border-table-border rounded-card px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-gray-600">Monthly recognition budget</span>
        <span className={`font-semibold ${budget.remaining === 0 ? "text-red-600" : "text-gray-700"}`}>
          {budget.used} / {budget.total} pts used — {budget.remaining} remaining
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
