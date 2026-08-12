import type { Listing } from "../../types";
import { computeSellerTotals, isClosed } from "../../utils";

interface SellerSummaryMetricsProps {
  listings: Listing[];
}

export function SellerSummaryMetrics({ listings }: SellerSummaryMetricsProps) {
  const activeCount = listings.filter((l) => !isClosed(l)).length;
  const totals = computeSellerTotals(listings);

  const metrics = [
    { label: "Active Listings", value: String(activeCount) },
    { label: "Orders", value: String(totals.orderCount) },
    { label: "To Prepare", value: `${totals.quantity} portion${totals.quantity === 1 ? "" : "s"}` },
    { label: "Outstanding", value: `₱${totals.outstanding.toFixed(2)}`, tone: totals.outstanding > 0 ? "text-rose-500" : "text-gray-900" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-white rounded-card border border-table-border p-4">
          <p className="font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">{m.label}</p>
          <p className={`text-2xl font-black mt-1 ${m.tone ?? "text-gray-900"}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
