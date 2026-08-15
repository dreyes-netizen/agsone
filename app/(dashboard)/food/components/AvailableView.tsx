"use client";

import { useMemo, useState } from "react";
import { SearchX, UtensilsCrossed } from "lucide-react";
import type { Listing, FoodSortOption } from "../types";
import { filterAndSortListings, getDepartmentOptions } from "../lib/filterListings";
import { AvailableToolbar } from "./AvailableToolbar";
import { FoodListingCard } from "./FoodListingCard";
import { FoodEmptyState } from "./FoodEmptyState";

const GRID_CLASSES = "flex flex-col gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4";

interface AvailableViewProps {
  listings: Listing[];
  loading: boolean;
  currentUserId: string | undefined;
  cardImageIndices: Record<string, number>;
  onImageIndexChange: (listingId: string, index: number) => void;
  onOpenDetail: (listing: Listing) => void;
  onOpenOrder: (listing: Listing) => void;
  onOpenEditOrder: (listing: Listing) => void;
  onCancelOrder: (listing: Listing) => void;
  onViewUser: (userId: string) => void;
}

export function AvailableView(props: AvailableViewProps) {
  const {
    listings, loading, currentUserId, cardImageIndices, onImageIndexChange,
    onOpenDetail, onOpenOrder, onOpenEditOrder, onCancelOrder, onViewUser,
  } = props;

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [sort, setSort] = useState<FoodSortOption>("cutoffSoonest");

  const departments = useMemo(() => getDepartmentOptions(listings), [listings]);
  const filtered = useMemo(
    () => filterAndSortListings(listings, { search, department, sort }),
    [listings, search, department, sort]
  );
  const hasActiveFilters = search.trim() !== "" || department !== null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-full max-w-sm bg-gray-100 rounded-lg animate-pulse" />
        <div className={GRID_CLASSES} aria-label="Loading food listings" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-card border border-table-border overflow-hidden animate-pulse h-24 sm:h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <FoodEmptyState
        icon={UtensilsCrossed}
        title="No food listings right now"
        description="Be the first to post something for your coworkers to order."
      />
    );
  }

  return (
    <div className="space-y-4">
      <AvailableToolbar
        search={search}
        onSearchChange={setSearch}
        department={department}
        onDepartmentChange={setDepartment}
        departments={departments}
        sort={sort}
        onSortChange={setSort}
      />

      {filtered.length === 0 ? (
        <FoodEmptyState
          icon={SearchX}
          title="No matches"
          description="Try a different search or clear your filters."
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={() => { setSearch(""); setDepartment(null); }}
                className="text-sm font-semibold text-navy-600 hover:text-navy-700 border border-navy-200 hover:bg-navy-50 rounded-lg px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className={GRID_CLASSES}>
          {filtered.map((listing) => (
            <FoodListingCard
              key={listing.id}
              listing={listing}
              currentUserId={currentUserId}
              cardImageIndex={cardImageIndices[listing.id] ?? 0}
              onImageIndexChange={(i) => onImageIndexChange(listing.id, i)}
              onOpenDetail={onOpenDetail}
              onOpenOrder={onOpenOrder}
              onOpenEditOrder={onOpenEditOrder}
              onCancelOrder={onCancelOrder}
              onViewUser={onViewUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}
