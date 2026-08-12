import { Clock, Truck, Pencil, RefreshCw, UtensilsCrossed } from "lucide-react";
import type { Listing } from "../../types";
import { computeListingStats, formatCutoff, formatPrice, isClosed } from "../../utils";
import { SellerOrdersTable } from "./SellerOrdersTable";
import { ListingOverflowMenu } from "./ListingOverflowMenu";

interface SellerListingCardProps {
  listing: Listing;
  onEdit: (listing: Listing) => void;
  onCloseListing: (listing: Listing) => void;
  onSellAgain: (listing: Listing) => void;
  onDelete: (listing: Listing) => void;
  onTogglePaid: (listingId: string, orderId: string, paid: boolean) => void;
  onViewUser: (userId: string) => void;
}

export function SellerListingCard(props: SellerListingCardProps) {
  const { listing, onEdit, onCloseListing, onSellAgain, onDelete, onTogglePaid, onViewUser } = props;

  const closed = isClosed(listing);
  const stats = computeListingStats(listing);

  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Thumbnail */}
        {listing.imageUrls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrls[0]}
            alt=""
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0 border border-gray-100"
          />
        ) : (
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${closed ? "from-zinc-200 to-zinc-300" : "from-emerald-400 to-teal-500"}`}>
            <UtensilsCrossed className="w-7 h-7 text-white/80" aria-hidden="true" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 leading-snug">{listing.title}</h3>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                closed ? "text-gray-500 bg-gray-100" : "text-emerald-700 bg-emerald-50"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${closed ? "bg-gray-400" : "bg-emerald-500"}`} aria-hidden="true" />
              {closed ? "CLOSED" : "ACTIVE"}
            </span>
          </div>

          <p className="text-sm font-semibold text-emerald-600">{formatPrice(listing.price)} / portion</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Cutoff {formatCutoff(listing.cutoffAt)}
            </span>
            {listing.deliveryDate && (
              <span className="flex items-center gap-1 text-sky-600 font-medium">
                <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Delivery {new Date(listing.deliveryDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-600">
            {stats.orderCount} order{stats.orderCount === 1 ? "" : "s"} • {stats.quantity} portion{stats.quantity === 1 ? "" : "s"} • ₱{stats.total.toFixed(2)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={() => onEdit(listing)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            Edit
          </button>
          {closed ? (
            <button
              type="button"
              onClick={() => onSellAgain(listing)}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Sell Again
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCloseListing(listing)}
              className="text-sm font-medium text-red-500 hover:text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
            >
              Close
            </button>
          )}
          <ListingOverflowMenu
            onDelete={() => onDelete(listing)}
            deleteDisabled={listing._count.orders > 0}
            deleteDisabledReason={listing._count.orders > 0 ? "This listing has orders — close it instead to keep order history." : undefined}
          />
        </div>
      </div>

      {/* Orders */}
      <div className="border-t border-gray-100">
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</h4>
        </div>
        <SellerOrdersTable listing={listing} onTogglePaid={(orderId, paid) => onTogglePaid(listing.id, orderId, paid)} onViewUser={onViewUser} />
      </div>
    </div>
  );
}
