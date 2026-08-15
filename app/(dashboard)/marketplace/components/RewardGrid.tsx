import { SearchX } from "lucide-react";
import type { Reward } from "../types";
import { RewardCard } from "./RewardCard";
import { MarketplaceEmptyState } from "./MarketplaceEmptyState";

const GRID_CLASSES = "flex flex-col gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4";

interface RewardGridProps {
  loading: boolean;
  rewards: Reward[];
  balance: number;
  onOpen: (reward: Reward) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function RewardGrid({ loading, rewards, balance, onOpen, hasActiveFilters, onClearFilters }: RewardGridProps) {
  if (loading) {
    return (
      <div className={GRID_CLASSES} aria-label="Loading rewards" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-table-border overflow-hidden animate-pulse h-[88px] sm:h-56" />
        ))}
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <MarketplaceEmptyState
        icon={SearchX}
        title="No rewards found"
        description={hasActiveFilters ? "Try another search or clear your filters." : "Check back later for new rewards."}
        action={
          hasActiveFilters ? (
            <button
              onClick={onClearFilters}
              className="text-sm font-semibold text-navy-600 hover:text-navy-700 px-3 py-1.5 rounded-lg border border-navy-200 hover:bg-navy-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-500"
            >
              Clear filters
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className={GRID_CLASSES}>
      {rewards.map((reward) => (
        <RewardCard key={reward.id} reward={reward} balance={balance} onOpen={onOpen} />
      ))}
    </div>
  );
}
