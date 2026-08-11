"use client";

import { Loader2 } from "lucide-react";
import type { MedicineRequest } from "@/lib/types/adminMedicine";

export function PendingRequestsTable({
  pending,
  actioningId,
  onAction,
}: {
  pending: MedicineRequest[];
  actioningId: string | null;
  onAction: (requestId: string, action: "approve" | "reject") => void;
}) {
  if (pending.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Pending ({pending.length})
      </h2>
       {/* Desktop table */}
       <div className="hidden sm:block bg-white rounded-card border border-table-border overflow-clip">
         <div className="overflow-auto max-h-[70vh] scroll-hint">
         <table className="w-full border-collapse" aria-label="Pending medicine requests">
           <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-table-border">
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Employee</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Medicine</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Qty</th>
                <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Requested</th>
                <th scope="col" className="px-3.5 py-2.5 last:pr-5" />
              </tr>
           </thead>
          <tbody>
            {pending.map((r, i) => (
              <tr key={r.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{r.user.displayName}</td>
                <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.medicine.name}</td>
                <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.quantity}</td>
                <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </td>
                <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onAction(r.id, "approve")}
                      disabled={actioningId === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-700"
                    >
                      {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Approve
                    </button>
                    <button
                      onClick={() => onAction(r.id, "reject")}
                      disabled={actioningId === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
                    >
                      {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="block sm:hidden space-y-3">
        {pending.map((r) => (
          <div key={r.id} className="bg-white rounded-card border border-table-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900 text-sm">{r.user.displayName}</p>
              <span className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
            </div>
              <p className="text-gray-700 text-sm">{r.medicine.name} × {r.quantity}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAction(r.id, "approve")}
                disabled={actioningId === r.id}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-emerald-700"
              >
                {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Approve
              </button>
              <button
                onClick={() => onAction(r.id, "reject")}
                disabled={actioningId === r.id}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
              >
                {actioningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
