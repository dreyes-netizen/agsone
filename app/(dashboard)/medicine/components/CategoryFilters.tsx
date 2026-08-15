import { MEDICINE_CATEGORY_LABEL, MEDICINE_CATEGORIES, type MedicineCategory } from "@/lib/constants/medicineCategories";

export type CategoryFilter = "ALL" | MedicineCategory;

interface CategoryFiltersProps {
  active: CategoryFilter;
  counts: Record<string, number>;
  total: number;
  loading: boolean;
  onChange: (category: CategoryFilter) => void;
}

// Text-only chips (no icons) — a deliberately more restrained toolbar than
// Marketplace's icon-per-category filters, in keeping with Medicine's own,
// less commerce-flavored identity.
export function CategoryFilters({ active, counts, total, loading, onChange }: CategoryFiltersProps) {
  const categories: CategoryFilter[] = ["ALL", ...MEDICINE_CATEGORIES];

  return (
    <div role="group" aria-label="Filter by category" className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
      {categories.map((cat) => {
        const isActive = active === cat;
        const count = cat === "ALL" ? total : (counts[cat] ?? 0);
        const disabled = count === 0 && cat !== "ALL";
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            disabled={disabled}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
              disabled
                ? "opacity-40 cursor-not-allowed bg-white border-gray-200 text-gray-500"
                : isActive
                ? "bg-command-black text-white border-command-black"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {cat === "ALL" ? "All" : MEDICINE_CATEGORY_LABEL[cat]}
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
