import { UtensilsCrossed } from "lucide-react";
import type { Listing } from "../../types";
import { SellerSummaryMetrics } from "./SellerSummaryMetrics";
import { SellerListingCard } from "./SellerListingCard";

interface SellingViewProps {
  listings: Listing[];
  loading: boolean;
  onSellFood: () => void;
  onEdit: (listing: Listing) => void;
  onCloseListing: (listing: Listing) => void;
  onSellAgain: (listing: Listing) => void;
  onDelete: (listing: Listing) => void;
  onTogglePaid: (listingId: string, orderId: string, paid: boolean) => void;
  onViewUser: (userId: string) => void;
}

export function SellingView(props: SellingViewProps) {
  const { listings, loading, onSellFood, onEdit, onCloseListing, onSellAgain, onDelete, onTogglePaid, onViewUser } = props;

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-card border border-table-border p-4 h-[70px]" />
          ))}
        </div>
        <div className="bg-white rounded-card border border-table-border h-40" />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-card border border-table-border text-center px-6">
        <UtensilsCrossed className="w-10 h-10 text-gray-500 mb-4" aria-hidden="true" />
        <p className="text-gray-600 font-medium">You aren&apos;t selling anything yet.</p>
        <p className="text-gray-500 text-sm mt-1 max-w-sm">Create a food listing to start accepting orders from your coworkers.</p>
        <button
          type="button"
          onClick={onSellFood}
          className="mt-4 flex items-center gap-2 bg-command-black hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
        >
          <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
          Sell Food
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SellerSummaryMetrics listings={listings} />
      <div className="space-y-4">
        {listings.map((listing) => (
          <SellerListingCard
            key={listing.id}
            listing={listing}
            onEdit={onEdit}
            onCloseListing={onCloseListing}
            onSellAgain={onSellAgain}
            onDelete={onDelete}
            onTogglePaid={onTogglePaid}
            onViewUser={onViewUser}
          />
        ))}
      </div>
    </div>
  );
}
