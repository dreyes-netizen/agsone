import { Clock, Truck } from "lucide-react";
import type { Listing } from "../types";
import { formatPrice, formatCutoff, formatDateTime, computeOrderTotal, isClosed, getUrgencyLabel, initials } from "../utils";
import { FoodImage } from "./FoodImage";

interface FoodListingCardProps {
  listing: Listing;
  currentUserId: string | undefined;
  cardImageIndex: number;
  onImageIndexChange: (index: number) => void;
  onOpenDetail: (listing: Listing) => void;
  onOpenOrder: (listing: Listing) => void;
  onOpenEditOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
  onViewUser: (userId: string) => void;
}

const MAX_VISIBLE_ADD_ONS = 2;

export function FoodListingCard(props: FoodListingCardProps) {
  const { listing, onOpenDetail, onOpenOrder, onOpenEditOrder, onCancelOrder, onViewUser } = props;

  const closed = isClosed(listing);
  const hasOrder = !!listing.myOrder;
  const urgent = !closed ? getUrgencyLabel(listing.cutoffAt) : null;
  const addOns = listing.addOns ?? [];
  const visibleAddOns = addOns.slice(0, MAX_VISIBLE_ADD_ONS);
  const extraAddOnCount = addOns.length - visibleAddOns.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(listing)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(listing);
        }
      }}
      aria-label={`View details for ${listing.title}`}
      className="bg-white rounded-card border border-table-border overflow-hidden cursor-pointer flex flex-row items-center sm:flex-col sm:items-stretch sm:hover:shadow-md sm:hover:-translate-y-0.5 sm:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
    >
      {/* Image */}
      <div className="relative shrink-0 w-24 h-24 sm:w-full sm:h-auto">
        <FoodImage
          src={listing.imageUrls[0]}
          alt={listing.title}
          sizes="(min-width: 1280px) 19vw, (min-width: 1024px) 24vw, (min-width: 768px) 32vw, (min-width: 640px) 48vw, 96px"
          className="w-full h-full sm:aspect-[4/3]"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-4 gap-1.5 sm:gap-2">
        {/* Seller row */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewUser(listing.createdBy.id); }}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity self-start"
        >
          {listing.createdBy.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.createdBy.avatarUrl} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-navy-500 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0">
              {initials(listing.createdBy.displayName)}
            </div>
          )}
          <span className="text-xs text-gray-500 truncate">
            {listing.createdBy.displayName}
            {listing.createdBy.department?.name && (
              <span className="text-gray-400"> · {listing.createdBy.department.name}</span>
            )}
          </span>
        </button>

        {/* Title + description */}
        <div>
          <h3 className="font-bold text-gray-900 leading-snug hover:text-emerald-700 transition-colors line-clamp-2 text-sm sm:text-base">
            {listing.title}
          </h3>
          {listing.description && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">{listing.description}</p>
          )}
        </div>

        {/* Price */}
        <div>
          <span className="text-base sm:text-lg font-bold text-emerald-600">{formatPrice(listing.price)}</span>
          <span className="text-xs font-medium text-gray-500 ml-1">/ portion</span>
        </div>

        {/* Cutoff + delivery */}
        <div className="flex flex-col gap-0.5">
          <span className={`flex items-center gap-1 text-xs ${closed ? "text-gray-500" : urgent ? "text-amber-600 font-medium" : "text-gray-600"}`}>
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
            {closed ? "Orders closed" : `Order by ${formatCutoff(listing.cutoffAt)}`}
          </span>
          {listing.deliveryDate && (
            <span className="flex items-center gap-1 text-xs text-sky-600 font-medium">
              <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
              {formatDateTime(listing.deliveryDate)}
            </span>
          )}
        </div>

        {/* Add-ons */}
        {addOns.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleAddOns.map((a, i) => (
              <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                + {a.name}{a.price > 0 ? ` ₱${a.price % 1 === 0 ? a.price : a.price.toFixed(2)}` : ""}
              </span>
            ))}
            {extraAddOnCount > 0 && (
              <span className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">
                +{extraAddOnCount} more
              </span>
            )}
          </div>
        )}

        {/* Social proof */}
        <span className="text-[11px] text-gray-400">
          {listing._count.orders} {listing._count.orders === 1 ? "order" : "orders"}
        </span>

        {/* Primary action area */}
        <div className="mt-auto pt-2 border-t border-gray-100">
          {closed && !hasOrder && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg w-full block text-center">
              Orders closed
            </span>
          )}

          {!closed && !hasOrder && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenOrder(listing); }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
            >
              Order
            </button>
          )}

          {hasOrder && (() => {
            const myOrder = listing.myOrder!;
            const total = computeOrderTotal(parseFloat(listing.price), myOrder);
            return (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700">Your Order</p>
                    <p className="text-xs text-gray-600">
                      ×{myOrder.quantity} {listing.title} <span className="text-gray-500">@ {formatPrice(listing.price)} each</span>
                    </p>
                    <p className="text-[11px] text-gray-500">Ordered {formatDateTime(myOrder.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-emerald-700">₱{total.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">total</p>
                  </div>
                </div>
                {!closed && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenEditOrder(listing); }}
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
        </div>
      </div>
    </div>
  );
}
