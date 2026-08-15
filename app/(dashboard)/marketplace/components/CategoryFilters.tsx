import { REWARD_CATEGORY_CONFIG, REWARD_CATEGORIES, type RewardCategory } from "@/lib/constants/rewardCategories";

export type CategoryFilter = "ALL" | RewardCategory;

interface CategoryFiltersProps {
  active: CategoryFilter;
  counts: Record<string, number>;
  total: number;
  loading: boolean;
  onChange: (category: CategoryFilter) => void;
}

export function CategoryFilters({ active, counts, total, loading, onChange }: CategoryFiltersProps) {
  const categories: CategoryFilter[] = ["ALL", ...REWARD_CATEGORIES];

  return (
    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const config = cat === "ALL" ? null : REWARD_CATEGORY_CONFIG[cat];
        const isActive = active === cat;
        const count = cat === "ALL" ? total : (counts[cat] ?? 0);
        const disabled = count === 0 && cat !== "ALL";
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
              disabled
                ? "opacity-40 cursor-not-allowed bg-white border-gray-200 text-gray-500"
                : isActive
                ? "bg-command-black text-white border-command-black"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {config && <config.icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : config.iconClass}`} aria-hidden="true" />}
            {cat === "ALL" ? "All Rewards" : config!.label}
            {!loading && (
              <span className={`text-xs tabular-nums ${isActive ? "text-white/70" : "text-gray-500"}`} aria-label={`${count} items`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
