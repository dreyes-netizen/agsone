import { History, Trophy } from "lucide-react";
import type { PointsData, TimelineEntry } from "../types";
import { txTypeLabel, CATEGORY_BADGE } from "../utils";

interface PointsTabProps {
  pointsData: PointsData;
  visibleCount: number;
  onLoadMore: () => void;
}

export function PointsTab({ pointsData, visibleCount, onLoadMore }: PointsTabProps) {
  return (
    <>
      {/* Balance card */}
      <div className="bg-white rounded-card border border-table-border p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Balance</p>
            <p className="text-4xl font-black text-navy-600 leading-none mt-1">
              {pointsData.balance.toLocaleString()}
              <span className="text-lg font-semibold text-gray-500 ml-1">pts</span>
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-navy-100 text-navy-700 text-xs font-bold px-3 py-1 rounded-full">
              Level {pointsData.level}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Total earned:{" "}
              <span className="font-semibold text-gray-700">
                {pointsData.totalEarned.toLocaleString()} pts
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Unified timeline */}
      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-800">Transaction History</h2>
        </div>
        {(() => {
          const entries: TimelineEntry[] = [
            ...pointsData.transactions.map((t): TimelineEntry => ({ kind: "earn", data: t })),
            ...pointsData.redemptions.map((r): TimelineEntry => ({ kind: "redeem", data: r })),
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
                    onClick={onLoadMore}
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
    </>
  );
}
