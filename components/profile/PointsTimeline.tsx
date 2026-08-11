"use client";

import { History, Trophy } from "lucide-react";
import type { PointTx, RedemptionTx, TimelineEntry } from "@/lib/hooks/useProfileActions";

export const txTypeLabel: Record<string, { label: string; color: string }> = {
  MANUAL_AWARD: { label: "Award",      color: "text-emerald-600" },
  KPI:          { label: "KPI",        color: "text-navy-600" },
  CONTEST:      { label: "Contest",    color: "text-yellow-600" },
  REDEMPTION:   { label: "Redemption", color: "text-rose-500" },
  GAME_WIN:     { label: "Game Win",   color: "text-emerald-500" },
  GAME_SPEND:   { label: "Game",       color: "text-orange-500" },
  REFUND:       { label: "Refund",     color: "text-gray-600" },
  MILESTONE:    { label: "Milestone",  color: "text-amber-600" },
  DEDUCTION:    { label: "Violation Deduction", color: "text-red-600" },
};

const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-navy-50 text-navy-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-blue-50 text-blue-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};

export function PointsTimeline({
  transactions,
  redemptions,
  visibleCount,
  setVisibleCount,
}: {
  transactions: PointTx[];
  redemptions: RedemptionTx[];
  visibleCount: number;
  setVisibleCount: (value: number | ((prev: number) => number)) => void;
}) {
  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <History className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-gray-800">Transaction History</h2>
      </div>
      {(() => {
        const entries: TimelineEntry[] = [
          ...transactions.map((t): TimelineEntry => ({ kind: "earn", data: t })),
          ...redemptions.map((r): TimelineEntry => ({ kind: "redeem", data: r })),
        ].sort(
          (a, b) =>
            new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
        );

        if (entries.length === 0) {
          return (
            <div className="flex flex-col items-center py-10 gap-2 text-center px-4">
              <Trophy className="w-8 h-8 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-500">No points yet</p>
              <p className="text-xs text-gray-500">Earn points through recognition, milestones, or games!</p>
            </div>
          );
        }

        const visible = entries.slice(0, visibleCount);
        return (
          <>
            <ul className="divide-y divide-gray-100">
              {visible.map((entry) => {
                if (entry.kind === "earn") {
                  const t = entry.data;
                  const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-gray-600" };
                  const positive = t.amount >= 0;
                  return (
                    <li key={`earn-${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                        {positive ? "+" : ""}{t.amount.toLocaleString()} pts
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.note ?? meta.label}</p>
                        <p className="text-xs text-gray-500">
                          <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                          {t.category && CATEGORY_BADGE[t.category] && (
                            <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[t.category].style}`}>
                              {CATEGORY_BADGE[t.category].label}
                            </span>
                          )}
                          {t.fromUser ? ` · from ${t.fromUser.displayName}` : ""}
                          {" · "}{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </li>
                  );
                } else {
                  const r = entry.data;
                  return (
                    <li key={`redeem-${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">
                        -{r.pointsSpent.toLocaleString()} pts
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.reward.name}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-medium text-rose-500">Redemption</span>
                          {" · "}{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </li>
                  );
                }
              })}
            </ul>
            {entries.length > visibleCount && (
              <div className="px-5 py-3 border-t border-gray-100">
                <button
                  onClick={() => setVisibleCount((c) => c + 10)}
                  className="text-sm text-navy-600 hover:text-navy-700 font-medium transition-colors"
                >
                  Load more ({entries.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
