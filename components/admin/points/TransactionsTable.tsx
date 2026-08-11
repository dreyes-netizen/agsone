"use client";

import { Loader2, History } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import type { Transaction } from "@/lib/hooks/useAdminPointsActions";

const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-navy-50 text-navy-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-blue-50 text-blue-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};

const thClass =
  "text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5";
const tdClass = "px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5";

export function TransactionsTable({
  transactions,
  txLoading,
  txError,
  txPage,
  txPages,
  setTxPage,
  onRetry,
}: {
  transactions: Transaction[];
  txLoading: boolean;
  txError: string | null;
  txPage: number;
  txPages: number;
  setTxPage: (page: number) => void;
  onRetry: () => void;
}) {
  return (
    <div className="bg-white rounded-card border border-table-border overflow-clip">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Recent Transactions</h2>
      </div>
      {txError && (
        <div role="alert" className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{txError}</span>
          <button
            onClick={onRetry}
            className="font-medium underline underline-offset-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-600"
          >
            Retry
          </button>
        </div>
      )}
      <div className="overflow-auto max-h-[70vh] scroll-hint">
      <table className="w-full border-collapse" aria-label="Recent transactions">
        <thead className="sticky top-0 z-10 bg-table-head">
          <tr className="border-b border-table-border">
            <th scope="col" className={thClass}>Recipient</th>
            <th scope="col" className={thClass}>Awarded By</th>
            <th scope="col" className={thClass}>Points</th>
            <th scope="col" className={thClass}>Category</th>
            <th scope="col" className={thClass}>Note</th>
            <th scope="col" className={thClass}>Date</th>
          </tr>
        </thead>
        <tbody>
          {txLoading ? (
            <tr>
              <td colSpan={6} className="text-center py-12"><div role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div></td>
            </tr>
          ) : transactions.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12">
                <div className="flex flex-col items-center justify-center gap-2">
                  <History className="w-8 h-8 text-gray-300" aria-hidden="true" />
                  <p className="text-table-muted text-[13px]">No transactions yet</p>
                </div>
              </td>
            </tr>
          ) : (
            transactions.map((t, i) => (
              <tr
                key={t.id}
                className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}
              >
                <td className={`${tdClass} font-medium text-gray-900`}>
                  {t.toUser?.displayName ?? "—"}
                </td>
                <td className={`${tdClass} text-gray-500`}>
                  {t.fromUser?.displayName ?? "System"}
                </td>
                <td className={tdClass}>
                  <span className={`font-semibold ${t.amount < 0 ? "text-rose-500" : "text-navy-600"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}
                  </span>
                </td>
                <td className={tdClass}>
                  {t.category && CATEGORY_BADGE[t.category] ? (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[t.category].style}`}>
                      {CATEGORY_BADGE[t.category].label}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className={`${tdClass} text-gray-500 max-w-xs truncate`}>{t.note}</td>
                <td className={`${tdClass} text-gray-500`}>
                  {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      <div className="px-6 py-4">
        <Pagination page={txPage} pages={txPages} onPageChange={setTxPage} />
      </div>
    </div>
  );
}
