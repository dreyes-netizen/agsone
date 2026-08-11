import type { PointsData, PointTx } from "../types";
import { txTypeLabel } from "../utils";

interface RecentActivityWidgetProps {
  pointsData: PointsData | null;
  onViewAll: () => void;
}

export function RecentActivityWidget({ pointsData, onViewAll }: RecentActivityWidgetProps) {
  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
        <button onClick={onViewAll} className="text-xs text-navy-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 rounded">
          View all →
        </button>
      </div>
      {pointsData && pointsData.transactions.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {(() => {
            const deduped: { t: PointTx; count: number }[] = [];
            for (const t of pointsData.transactions.slice(0, 6)) {
              const last = deduped[deduped.length - 1];
              if (last && last.t.note === t.note && last.t.type === t.type) { last.count++; }
              else { deduped.push({ t, count: 1 }); }
            }
            return deduped.slice(0, 3).map(({ t, count }) => {
              const positive = t.amount >= 0;
              const meta = txTypeLabel[t.type] ?? { label: t.type, color: "text-gray-600" };
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-xs font-bold shrink-0 ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                    {positive ? "+" : ""}{t.amount.toLocaleString()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{t.note ?? meta.label}</p>
                    <p className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  {count > 1 && (
                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">×{count}</span>
                  )}
                </li>
              );
            });
          })()}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 text-center py-4">No activity yet</p>
      )}
    </div>
  );
}
