import type { Reward, SortOption } from "../types";
import type { CategoryFilter } from "../components/CategoryFilters";

export interface RewardFilters {
  category: CategoryFilter;
  search: string;
  sort: SortOption;
  availableOnly: boolean;
  affordableOnly: boolean;
  balance: number;
}

const SORT_COMPARATORS: Record<SortOption, (a: Reward, b: Reward) => number> = {
  recommended: (a, b) => a.pointCost - b.pointCost,
  lowest: (a, b) => a.pointCost - b.pointCost,
  highest: (a, b) => b.pointCost - a.pointCost,
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  mostRedeemed: (a, b) => (b._count?.redemptions ?? 0) - (a._count?.redemptions ?? 0),
};

// Pure so it can be unit-tested without a DOM — search, category, availability,
// and affordability filters, the chosen sort, then a stable out-of-stock sink
// so unavailable rewards stay browsable but drop to the bottom of the grid.
export function filterAndSortRewards(rewards: Reward[], filters: RewardFilters): Reward[] {
  const q = filters.search.trim().toLowerCase();

  const filtered = rewards.filter((r) => {
    if (filters.category !== "ALL" && r.category !== filters.category) return false;
    if (filters.availableOnly && r.stockQuantity === 0) return false;
    if (filters.affordableOnly && r.pointCost > filters.balance) return false;
    if (q) {
      const haystack = `${r.name} ${r.description ?? ""} ${r.category}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(SORT_COMPARATORS[filters.sort]);
  return sorted.sort((a, b) => (a.stockQuantity === 0 ? 1 : 0) - (b.stockQuantity === 0 ? 1 : 0));
}
