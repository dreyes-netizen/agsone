"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, Truck, RefreshCw } from "lucide-react";
import type { Listing, OrderRow } from "@/lib/types/food";
import { formatPrice, formatCutoff, isClosed } from "@/lib/helpers/food";
import { SellerOrdersPanel } from "@/components/food/SellerOrdersPanel";

export function ListingCard({
  listing,
  dbUserId,
  expandedId,
  sellerOrders,
  cardImageIndices,
  setCardImageIndices,
  router,
  onOpenListing,
  onStartOrder,
  onEditOrder,
  onCancelOrder,
  onToggleSellerOrders,
  onEditListing,
  onCloseListing,
  onSellAgain,
  onDeleteListing,
  onTogglePaid,
}: {
  listing: Listing;
  dbUserId?: string;
  expandedId: string | null;
  sellerOrders: Record<string, OrderRow[]>;
  cardImageIndices: Record<string, number>;
  setCardImageIndices: Dispatch<SetStateAction<Record<string, number>>>;
  router: ReturnType<typeof useRouter>;
  onOpenListing: (listing: Listing) => void;
  onStartOrder: (listing: Listing) => void;
  onEditOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
  onToggleSellerOrders: (listing: Listing) => void;
  onEditListing: (listing: Listing) => void;
  onCloseListing: (listing: Listing) => void;
  onSellAgain: (listing: Listing) => void;
  onDeleteListing: (listing: Listing) => void;
  onTogglePaid: (listingId: string, orderId: string, paid: boolean) => void;
}) {
  const closed = isClosed(listing);
  const isMine = listing.createdBy.id === dbUserId;
  const isExpanded = expandedId === listing.id;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenListing(listing)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenListing(listing);
        }
      }}
      className="bg-white rounded-card border border-table-border overflow-hidden flex flex-col transition-shadow cursor-pointer"
    >

      {/* Mobile: image left + content right | Desktop: image top + content below */}
      <div className="flex flex-row items-center sm:flex-col sm:items-stretch">

        {/* Image / accent */}
        {listing.imageUrls.length > 0 ? (() => {
          const idx = cardImageIndices[listing.id] ?? 0;
          const total = listing.imageUrls.length;
          const setIdx = (i: number) => setCardImageIndices((prev) => ({ ...prev, [listing.id]: i }));
          return (
            <div
              className="relative group shrink-0 w-[120px] h-[120px] sm:w-full sm:h-auto"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.imageUrls[idx]}
                alt={listing.title}
                loading="lazy"
                className="w-full h-full object-contain bg-white sm:aspect-square"
              />
              {/* Carousel — desktop only */}
              {total > 1 && (
                <div className="hidden sm:block">
                  <button
                    aria-label="Previous image"
                    onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + total) % total); }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    aria-label="Next image"
                    onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % total); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {listing.imageUrls.map((_, i) => (
                      <button
                        key={i}
                        aria-label={`Image ${i + 1} of ${total}`}
                        aria-current={i === idx ? "true" : undefined}
                        onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                        className={`w-2 h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${i === idx ? "bg-white" : "bg-white/50"}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* Mobile image counter */}
              {total > 1 && (
                <span className="sm:hidden absolute bottom-1 right-1 bg-black/50 text-white text-[9px] font-medium px-1 py-px rounded">
                  {idx + 1}/{total}
                </span>
              )}
            </div>
          );
        })() : (
          // Mobile: thin left strip | Desktop: square gradient placeholder
          <>
            <div className={`shrink-0 self-stretch w-1.5 bg-gradient-to-b sm:hidden ${closed ? "bg-gray-300" : "bg-emerald-500"}`} />
            <div className={`hidden sm:flex sm:w-full sm:aspect-square sm:items-center sm:justify-center sm:bg-gradient-to-br ${closed ? "from-zinc-200 to-zinc-300" : "from-emerald-400 to-emerald-600"}`}>
              <UtensilsCrossed className="w-12 h-12 text-white/70" aria-hidden="true" />
            </div>
          </>
        )}

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-4 gap-1.5 sm:gap-2">

          {/* Seller */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/employees/${listing.createdBy.id}`); }}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0 flex-1"
            >
              {listing.createdBy.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.createdBy.avatarUrl} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-navy-500 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0">
                  {listing.createdBy.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              )}
              <span className="text-xs text-gray-500 truncate">{listing.createdBy.displayName}</span>
            </button>
            <span className="hidden sm:inline shrink-0 text-xs text-gray-500">{listing._count.orders} orders</span>
          </div>

          {/* Title — click to open modal */}
          <button
            type="button"
            aria-label={`View details for ${listing.title}`}
            onClick={() => onOpenListing(listing)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 rounded"
          >
            <h3 className="font-bold text-gray-900 leading-snug hover:text-emerald-700 transition-colors line-clamp-2 text-sm sm:text-base">{listing.title}</h3>
            {listing.description && (
              <div className="hidden sm:block">
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{listing.description}</p>
              </div>
            )}
          </button>

          {/* Price + cutoff */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-base sm:text-lg font-bold text-emerald-600 shrink-0">{formatPrice(listing.price)}</span>
            <span className={`flex items-center gap-1 text-xs shrink-0 ${closed ? "text-gray-500" : "text-amber-600"}`}>
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              {closed ? "Closed" : `By ${formatCutoff(listing.cutoffAt)}`}
            </span>
          </div>

          {/* Delivery — desktop only */}
          {listing.deliveryDate && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-navy-600 font-medium">
              <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Delivery: {new Date(listing.deliveryDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>
          )}

          {/* Add-ons badges — desktop only */}
          {(listing.addOns?.length ?? 0) > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1">
              {(listing.addOns ?? []).map((a, i) => (
                <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  +{a.name}{a.price > 0 ? ` ₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : " (free)"}
                </span>
              ))}
            </div>
          )}

        {/* Action area */}
        <div className="mt-auto pt-2 sm:pt-3 border-t border-gray-100 space-y-2">
          {closed && !isMine && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg w-full block text-center">
              Orders closed
            </span>
          )}

          {/* Order button — opens modal */}
          {!closed && !isMine && !listing.myOrder && (
            <button
              onClick={() => onStartOrder(listing)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
            >
              Order
            </button>
          )}

          {/* Existing order summary on card */}
          {!isMine && listing.myOrder && (() => {
            const oQty = listing.myOrder.quantity;
            const base = parseFloat(listing.price);
            const addOnSum = (listing.myOrder.selectedAddOns ?? []).reduce((s, a) => s + a.price, 0);
            const total = (base + addOnSum) * oQty;
            return (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">Your Order</p>
                    <p className="text-xs text-gray-600">×{oQty} {listing.title} <span className="text-gray-500">@ {formatPrice(listing.price)} each</span></p>
                    <p className="text-[11px] text-gray-500">
                      Ordered {new Date(listing.myOrder.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-emerald-700">₱{total.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">total</p>
                  </div>
                </div>
                {!closed && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onEditOrder(listing)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                    >
                      Edit order
                    </button>
                    <span className="text-gray-200">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onCancelOrder(listing); }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                    >
                      Cancel order
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Seller view */}
          {isMine && (
            <div className="space-y-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSellerOrders(listing); }}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Hide" : "View"} orders for ${listing.title}`}
                 className="w-full flex items-center justify-between text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
              >
                <span>View Orders ({listing._count.orders})</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditListing(listing); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />Edit
                </button>
                {!closed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCloseListing(listing); }}
                    className="flex-1 text-sm text-red-500 hover:text-red-600 font-medium border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                )}
              </div>
              {closed && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSellAgain(listing); }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Sell Again
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteListing(listing); }}
                className="w-full text-xs text-gray-500 hover:text-red-500 transition-colors text-center py-0.5"
              >
                Delete listing
              </button>
            </div>
          )}
        </div>
        </div>
      </div>{/* end inner row */}

      {/* Seller order list (expanded) — always full width */}
      {isMine && isExpanded && (
        <SellerOrdersPanel
          listing={listing}
          orders={sellerOrders[listing.id]}
          router={router}
          onTogglePaid={onTogglePaid}
        />
      )}
    </div>
  );
}
