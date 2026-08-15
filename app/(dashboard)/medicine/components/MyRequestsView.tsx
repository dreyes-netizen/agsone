import { Pill } from "lucide-react";
import type { MedicineRequest } from "../types";
import { MedicineStatusBadge } from "./MedicineStatusBadge";
import { MedicineEmptyState } from "./MedicineEmptyState";

interface MyRequestsViewProps {
  loading: boolean;
  requests: MedicineRequest[];
  onOpenDetail: (request: MedicineRequest) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MyRequestsView({ loading, requests, onOpenDetail }: MyRequestsViewProps) {
  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading requests" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-table-border h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <MedicineEmptyState
        icon={Pill}
        title="No medicine requests yet"
        description="Medicines you request will appear here."
      />
    );
  }

  return (
    <>
      {/* Desktop: compact table */}
      <div className="hidden md:block bg-white rounded-card border border-table-border overflow-clip">
        <table className="w-full border-collapse" aria-label="My medicine requests">
          <thead className="bg-table-head">
            <tr className="border-b border-table-border">
              <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 first:pl-5">Medicine</th>
              <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Qty</th>
              <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Requested</th>
              <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
              <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 last:pr-5">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => (
              <tr key={r.id} className={`border-b border-row-border last:border-b-0 transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 first:pl-5">{r.medicine.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.quantity}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <MedicineStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 last:pr-5">
                  <button
                    onClick={() => onOpenDetail(r)}
                    className="text-sm font-semibold text-navy-600 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-navy-500 rounded"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked list */}
      <ul role="list" className="md:hidden space-y-3">
        {requests.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onOpenDetail(r)}
              className="w-full text-left bg-white rounded-card border border-table-border p-4 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900 leading-snug">{r.medicine.name}</p>
                <MedicineStatusBadge status={r.status} />
              </div>
              <p className="text-xs text-gray-500">{r.quantity} {r.quantity === 1 ? "unit" : "units"}</p>
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-500">Requested {formatDate(r.createdAt)}</span>
                <span className="text-xs font-semibold text-navy-600">View details →</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
