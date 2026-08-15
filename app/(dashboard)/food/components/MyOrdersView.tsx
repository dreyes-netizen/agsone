"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed, PackageOpen, CircleCheck, Circle, Clock, PackageCheck } from "lucide-react";
import type { Listing } from "../types";
import { computeOrderTotal, deriveOrderState, formatDateTime, formatPrice, initials, isClosed } from "../utils";
import { FoodImage } from "./FoodImage";
import { FoodEmptyState } from "./FoodEmptyState";

type OrderFilter = "ALL" | "ACTIVE" | "COMPLETED";

interface MyOrdersViewProps {
  listings: Listing[];
  loading: boolean;
  onOpenOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
  onBrowseAvailable: () => void;
}

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black";

function PaymentBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
        paid ? "text-emerald-700 bg-emerald-100" : "text-gray-600 bg-gray-100"
      }`}
    >
      {paid ? <CircleCheck className="w-3 h-3" aria-hidden="true" /> : <Circle className="w-3 h-3" aria-hidden="true" />}
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

function OrderStatusBadge({ state }: { state: "ACTIVE" | "COMPLETED" }) {
  const isActive = state === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
        isActive ? "text-sky-700 bg-sky-100" : "text-gray-600 bg-gray-100"
      }`}
    >
      {isActive ? <Clock className="w-3 h-3" aria-hidden="true" /> : <PackageCheck className="w-3 h-3" aria-hidden="true" />}
      {isActive ? "Active" : "Completed"}
    </span>
  );
}

export function MyOrdersView(props: MyOrdersViewProps) {
  const { listings, loading, onOpenOrder, onCancelOrder, onBrowseAvailable } = props;
  const [filter, setFilter] = useState<OrderFilter>("ALL");

  const myOrders = useMemo(() => listings.filter((l) => l.myOrder !== null), [listings]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return myOrders;
    return myOrders.filter((l) => deriveOrderState(l) === filter);
  }, [myOrders, filter]);

  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading your orders" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-table-border h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (myOrders.length === 0) {
    return (
      <FoodEmptyState
        icon={UtensilsCrossed}
        title="You haven't ordered anything yet."
        description="Food you order from coworkers will appear here."
        action={
          <button
            type="button"
            onClick={onBrowseAvailable}
            className={`flex items-center gap-2 bg-command-black hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${FOCUS_RING}`}
          >
            Browse available food
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Segmented filter */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by order status">
        {(["ALL", "ACTIVE", "COMPLETED"] as OrderFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${FOCUS_RING} ${
              filter === f
                ? "bg-command-black text-white border-command-black"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f === "ALL" ? "All" : f === "ACTIVE" ? "Active" : "Completed"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <FoodEmptyState
          icon={PackageOpen}
          title={filter === "ACTIVE" ? "No active orders." : "No completed orders."}
          description="Nothing here for this filter — try a different one."
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-card border border-table-border overflow-clip">
            <table className="w-full border-collapse" aria-label="My food orders">
              <thead className="bg-table-head">
                <tr className="border-b border-table-border">
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 first:pl-5">Food</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Seller</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Qty</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Total</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Delivery</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Payment</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                  <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 last:pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((listing, i) => {
                  const order = listing.myOrder!;
                  const basePrice = parseFloat(listing.price);
                  const total = computeOrderTotal(basePrice, order);
                  const state = deriveOrderState(listing);
                  const closed = isClosed(listing);
                  return (
                    <tr
                      key={listing.id}
                      className={`border-b border-row-border last:border-b-0 transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""}`}
                    >
                      <td className="px-4 py-3 first:pl-5">
                        <div className="flex items-center gap-3">
                          <FoodImage
                            src={listing.imageUrls[0]}
                            alt=""
                            sizes="40px"
                            className="w-10 h-10 rounded-lg shrink-0 overflow-hidden"
                          />
                          <span className="text-sm font-medium text-gray-900">{listing.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {listing.createdBy.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={listing.createdBy.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-navy-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {initials(listing.createdBy.displayName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 truncate">{listing.createdBy.displayName}</p>
                            {listing.createdBy.department && (
                              <p className="text-xs text-gray-500 truncate">{listing.createdBy.department.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.quantity}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 tabular-nums">{formatPrice(total.toString())}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {listing.deliveryDate ? formatDateTime(listing.deliveryDate) : "TBD"}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge paid={!!order.paidAt} />
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge state={state} />
                      </td>
                      <td className="px-4 py-3 last:pr-5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenOrder(listing)}
                            className={`text-sm font-semibold text-navy-600 hover:text-navy-700 rounded ${FOCUS_RING}`}
                          >
                            View
                          </button>
                          {!closed && (
                            <button
                              type="button"
                              onClick={() => onCancelOrder(listing)}
                              className={`text-sm font-medium text-red-500 hover:text-red-600 rounded ${FOCUS_RING}`}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul role="list" className="md:hidden space-y-3">
            {filtered.map((listing) => {
              const order = listing.myOrder!;
              const basePrice = parseFloat(listing.price);
              const total = computeOrderTotal(basePrice, order);
              const state = deriveOrderState(listing);
              const closed = isClosed(listing);
              return (
                <li key={listing.id} className="w-full bg-white rounded-card border border-table-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 leading-snug">{listing.title}</p>
                    <OrderStatusBadge state={state} />
                  </div>

                  <div className="flex items-center gap-2">
                    <FoodImage
                      src={listing.imageUrls[0]}
                      alt=""
                      sizes="32px"
                      className="w-8 h-8 rounded-lg shrink-0 overflow-hidden"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 truncate">{listing.createdBy.displayName}</p>
                      {listing.createdBy.department && (
                        <p className="text-[11px] text-gray-400 truncate">{listing.createdBy.department.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {order.quantity} × {formatPrice(listing.price)}
                    </span>
                    <span className="font-semibold text-gray-900">{formatPrice(total.toString())}</span>
                  </div>

                  <p className="text-xs text-gray-500">
                    Delivery: {listing.deliveryDate ? formatDateTime(listing.deliveryDate) : "TBD"}
                  </p>

                  <PaymentBadge paid={!!order.paidAt} />

                  <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => onOpenOrder(listing)}
                      className={`text-xs font-semibold text-navy-600 hover:text-navy-700 py-1 rounded ${FOCUS_RING}`}
                    >
                      View details
                    </button>
                    {!closed && (
                      <button
                        type="button"
                        onClick={() => onCancelOrder(listing)}
                        className={`text-xs font-medium text-red-500 hover:text-red-600 py-1 rounded ${FOCUS_RING}`}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
