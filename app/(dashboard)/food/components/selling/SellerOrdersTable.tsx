"use client";

import { useMemo, useState } from "react";
import { Search, PackageOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Listing, OrderRow } from "../../types";
import { computeOrderTotal, formatOrderTime, initials, matchesOrderSearch } from "../../utils";

type PaymentFilter = "ALL" | "PAID" | "UNPAID";

interface SellerOrdersTableProps {
  listing: Listing;
  onTogglePaid: (orderId: string, paid: boolean) => void;
  onViewUser: (userId: string) => void;
}

export function SellerOrdersTable({ listing, onTogglePaid, onViewUser }: SellerOrdersTableProps) {
  const orders = useMemo(() => listing.orders ?? [], [listing.orders]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("ALL");
  const [markPaidTarget, setMarkPaidTarget] = useState<OrderRow | null>(null);

  const basePrice = parseFloat(listing.price);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter === "PAID" && !o.paidAt) return false;
      if (filter === "UNPAID" && o.paidAt) return false;
      return matchesOrderSearch(o, search);
    });
  }, [orders, filter, search]);

  if (orders.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gray-500">No orders yet.</p>
        <p className="text-xs text-gray-400 mt-0.5">Orders will appear here when coworkers purchase this item.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-gray-100">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            aria-label="Search orders by customer name"
            className="w-full sm:max-w-xs pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-command-black"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Filter by payment status">
          {(["ALL", "PAID", "UNPAID"] as PaymentFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-command-black ${
                filter === f
                  ? "bg-command-black text-white border-command-black"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f === "ALL" ? "All" : f === "PAID" ? "Paid" : "Unpaid"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <PackageOpen className="w-6 h-6 text-gray-300 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-gray-500">No matching orders.</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filtered.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                basePrice={basePrice}
                onViewUser={onViewUser}
                onMarkPaid={() => setMarkPaidTarget(o)}
                onUndo={() => onTogglePaid(o.id, false)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse" aria-label={`Orders for ${listing.title}`}>
              <thead className="bg-table-head">
                <tr className="border-b border-table-border">
                  <th scope="col" className="text-left px-4 py-2 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">Customer</th>
                  <th scope="col" className="text-left px-3 py-2 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">Department</th>
                  <th scope="col" className="text-right px-3 py-2 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">Qty</th>
                  <th scope="col" className="text-left px-3 py-2 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">Ordered</th>
                  <th scope="col" className="text-right px-3 py-2 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">Amount</th>
                  <th scope="col" className="text-left px-3 py-2 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted">Payment</th>
                  <th scope="col" className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const isPaid = !!o.paidAt;
                  const rowTotal = computeOrderTotal(basePrice, o);
                  const addOnCount = o.selectedAddOns?.length ?? 0;
                  return (
                    <tr key={o.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}>
                      <td className="px-4 py-2.5 align-top">
                        <button
                          type="button"
                          onClick={() => onViewUser(o.user.id)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          {o.user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-navy-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {initials(o.user.displayName)}
                            </div>
                          )}
                          <span className="text-[13px] font-medium text-gray-900">{o.user.displayName}</span>
                        </button>
                        {(o.note || addOnCount > 0) && (
                          <p className="text-[11px] text-gray-500 mt-0.5 pl-8 max-w-[280px] line-clamp-2" title={o.note ?? undefined}>
                            {addOnCount > 0 && <span className="text-amber-600">+{addOnCount} add-on{addOnCount === 1 ? "" : "s"}</span>}
                            {addOnCount > 0 && o.note && " · "}
                            {o.note && <span className="italic">&ldquo;{o.note}&rdquo;</span>}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-gray-500 align-top">{o.user.department?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[13px] text-gray-700 text-right align-top">{o.quantity}</td>
                      <td className="px-3 py-2.5 text-[13px] text-gray-500 align-top whitespace-nowrap">{formatOrderTime(o.createdAt)}</td>
                      <td className="px-3 py-2.5 text-[13px] font-semibold text-gray-900 text-right align-top">₱{rowTotal.toFixed(2)}</td>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isPaid ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                          }`}
                        >
                          {isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right align-top">
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => onTogglePaid(o.id, false)}
                            className="text-xs text-gray-500 hover:text-red-500 font-medium transition-colors"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setMarkPaidTarget(o)}
                            className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AlertDialog open={!!markPaidTarget} onOpenChange={(open) => { if (!open) setMarkPaidTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark {markPaidTarget ? `₱${computeOrderTotal(basePrice, markPaidTarget).toFixed(2)}` : ""} as paid?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {markPaidTarget && (
                <>
                  {markPaidTarget.user.displayName} — {markPaidTarget.quantity} × {listing.title}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={() => {
                if (markPaidTarget) onTogglePaid(markPaidTarget.id, true);
                setMarkPaidTarget(null);
              }}
            >
              Mark as Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrderCard({
  order, basePrice, onViewUser, onMarkPaid, onUndo,
}: {
  order: OrderRow;
  basePrice: number;
  onViewUser: (userId: string) => void;
  onMarkPaid: () => void;
  onUndo: () => void;
}) {
  const isPaid = !!order.paidAt;
  const rowTotal = computeOrderTotal(basePrice, order);
  const addOnCount = order.selectedAddOns?.length ?? 0;

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onViewUser(order.user.id)} className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
          {order.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={order.user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-navy-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {initials(order.user.displayName)}
            </div>
          )}
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-gray-900 truncate">{order.user.displayName}</p>
            <p className="text-xs text-gray-500">{order.user.department?.name ?? "—"}</p>
          </div>
        </button>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            isPaid ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
          }`}
        >
          {isPaid ? "Paid" : "Unpaid"}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{order.quantity} portion{order.quantity === 1 ? "" : "s"}</span>
        <span className="font-semibold text-gray-900">₱{rowTotal.toFixed(2)}</span>
      </div>
      {addOnCount > 0 && (
        <p className="text-xs text-amber-600">+{addOnCount} add-on{addOnCount === 1 ? "" : "s"}</p>
      )}
      {order.note && <p className="text-xs text-gray-500 italic">&ldquo;{order.note}&rdquo;</p>}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">Ordered {formatOrderTime(order.createdAt)}</span>
        {isPaid ? (
          <button type="button" onClick={onUndo} className="text-xs text-gray-500 hover:text-red-500 font-medium transition-colors">
            Undo
          </button>
        ) : (
          <button
            type="button"
            onClick={onMarkPaid}
            className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            Mark Paid
          </button>
        )}
      </div>
    </div>
  );
}
