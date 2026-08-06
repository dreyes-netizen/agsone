import { Loader2, Pill, X } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { MEDICINE_REQUEST_STATUS_BADGE } from "@/lib/constants/medicineRequestStatus";
import type { MedicineRequest } from "../types";

const statusChip = MEDICINE_REQUEST_STATUS_BADGE;

interface MedicineRequestsPanelProps {
  loading: boolean;
  pending: MedicineRequest[];
  filteredHistory: MedicineRequest[];
  actioningId: string | null;
  onAction: (requestId: string, action: "approve" | "reject") => void;
  reqFilter: string;
  setReqFilter: React.Dispatch<React.SetStateAction<string>>;
  dateFrom: string;
  setDateFrom: React.Dispatch<React.SetStateAction<string>>;
  dateTo: string;
  setDateTo: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  onClearFilters: () => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function MedicineRequestsPanel(props: MedicineRequestsPanelProps) {
  const {
    loading, pending, filteredHistory, actioningId, onAction,
    reqFilter, setReqFilter, dateFrom, setDateFrom, dateTo, setDateTo, statusFilter, setStatusFilter,
    onClearFilters, page, pages, onPageChange,
  } = props;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-500 py-12">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
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
          )}

          <div>
            <div className="mb-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-900">History</h2>
                {(dateFrom || dateTo || statusFilter || reqFilter) && (
                  <button
                    onClick={onClearFilters}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                  >
                    <option value="">All</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Search</label>
                  <input
                    placeholder="Employee or medicine…"
                    value={reqFilter}
                    onChange={(e) => setReqFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
              </div>
            </div>
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Pill className="w-8 h-8 text-gray-300" aria-hidden="true" />
                <p className="text-sm text-gray-500">No history yet.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block bg-white rounded-card border border-table-border overflow-clip">
                  <div className="overflow-auto max-h-[70vh] scroll-hint">
                  <table className="w-full border-collapse" aria-label="Medicine request history">
                    <thead className="sticky top-0 z-10 bg-table-head">
                      <tr className="border-b border-table-border">
                        <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Employee</th>
                        <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Medicine</th>
                        <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Qty</th>
                        <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Requested</th>
                        <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Status</th>
                        <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Actioned by</th>
                      </tr>
                    </thead>
                   <tbody>
                     {filteredHistory.map((r, i) => (
                       <tr
                         key={r.id}
                         className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}
                       >
                          <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{r.user.displayName}</td>
                          <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.medicine.name}</td>
                          <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-700">{r.quantity}</td>
                          <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                           {new Date(r.createdAt).toLocaleDateString("en-US", {
                             month: "short", day: "numeric", year: "numeric",
                           })}
                         </td>
                         <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                           <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                             {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                           </span>
                         </td>
                         <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
                           {r.approvedBy?.displayName ?? "—"}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 </div>
                </div>

                {/* Mobile cards */}
                <div className="block sm:hidden space-y-3">
                  {filteredHistory.map((r) => (
                    <div key={r.id} className="bg-white rounded-card border border-table-border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900 text-sm">{r.user.displayName}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChip[r.status]}`}>
                          {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    <p className="text-gray-700 text-sm">{r.medicine.name} × {r.quantity}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </span>
                        <span>by {r.approvedBy?.displayName ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="pt-3">
              <Pagination page={page} pages={pages} onPageChange={onPageChange} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
