import { Loader2 } from "lucide-react";
import type { OrderRow } from "../types";
import { formatPrice } from "../utils";

interface SellerOrdersPanelProps {
  listingPrice: string;
  orders: OrderRow[] | undefined;
  onTogglePaid: (orderId: string, paid: boolean) => void;
  onViewUser: (userId: string) => void;
}

export function SellerOrdersPanel({ listingPrice, orders, onTogglePaid, onViewUser }: SellerOrdersPanelProps) {
  return (
    <div className="border-t border-gray-100 bg-gray-50">
      {!orders ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-500" /></div>
      ) : orders.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No orders yet.</p>
      ) : (() => {
        const totalQty = orders.reduce((s, o) => s + o.quantity, 0);
        const basePrice = parseFloat(listingPrice);
        const totalRevenue = orders.reduce((s, o) => {
          const addOnSum = (o.selectedAddOns ?? []).reduce((a, b) => a + b.price, 0);
          return s + (basePrice + addOnSum) * o.quantity;
        }, 0);
        const collected = orders.reduce((s, o) => {
          if (!o.paidAt) return s;
          const addOnSum = (o.selectedAddOns ?? []).reduce((a, b) => a + b.price, 0);
          return s + (basePrice + addOnSum) * o.quantity;
        }, 0);
        const outstanding = totalRevenue - collected;
        const addOnCounts: Record<string, number> = {};
        orders.forEach((o) => (o.selectedAddOns ?? []).forEach((a) => {
          addOnCounts[a.name] = (addOnCounts[a.name] ?? 0) + o.quantity;
        }));
        return (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-gray-200">
              <div className="text-center px-3 py-3 border-r border-b sm:border-b-0 border-gray-200">
                <p className="text-base font-black text-gray-800">{orders.length}</p>
                <p className="text-[10px] text-gray-500">orders</p>
              </div>
              <div className="text-center px-3 py-3 border-b sm:border-b-0 sm:border-r border-gray-200">
                <p className="text-base font-black text-gray-800">{totalQty}</p>
                <p className="text-[10px] text-gray-500">to prep</p>
              </div>
              <div className="text-center px-3 py-3 border-r border-gray-200">
                <p className="text-base font-black text-emerald-600">₱{collected.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500">collected</p>
              </div>
              <div className="text-center px-3 py-3">
                <p className="text-base font-black text-rose-500">₱{outstanding.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500">outstanding</p>
              </div>
            </div>

            {/* Add-on breakdown */}
            {Object.keys(addOnCounts).length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap gap-1.5">
                {Object.entries(addOnCounts).map(([name, count]) => (
                  <span key={name} className="text-[11px] bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {name} ×{count}
                  </span>
                ))}
              </div>
            )}

            {/* Order rows */}
            <div className="divide-y divide-zinc-100">
              {orders.map((o) => {
                const addOnSum = (o.selectedAddOns ?? []).reduce((a, b) => a + b.price, 0);
                const rowTotal = (basePrice + addOnSum) * o.quantity;
                const isPaid = !!o.paidAt;
                return (
                  <div key={o.id} className={`px-4 py-2.5 flex items-start gap-3 transition-colors ${isPaid ? "bg-emerald-50/50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onViewUser(o.user.id)}
                          className="text-xs font-semibold text-gray-800 hover:underline hover:text-navy-600 transition-colors"
                        >
                          {o.user.displayName}
                        </button>
                        {o.user.department && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{o.user.department.name}</span>
                        )}
                        {isPaid && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">✓ Paid</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">×{o.quantity} @ {formatPrice(listingPrice)} each</p>
                      {(o.selectedAddOns?.length ?? 0) > 0 && (
                        <p className="text-[11px] text-amber-600 mt-0.5">
                          {(o.selectedAddOns ?? []).map((a) => `+ ${a.name} (₱${a.price.toFixed(2)})`).join(", ")}
                        </p>
                      )}
                      {o.note && <p className="text-[11px] text-gray-500 italic mt-0.5">&ldquo;{o.note}&rdquo;</p>}
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(o.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1.5">
                      <p className={`text-sm font-bold ${isPaid ? "text-emerald-600" : "text-gray-700"}`}>₱{rowTotal.toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => onTogglePaid(o.id, !isPaid)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                          isPaid
                            ? "border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {isPaid ? "Undo" : "Mark paid"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}
