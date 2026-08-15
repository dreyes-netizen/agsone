import { MEDICINE_CATEGORY_LABEL } from "@/lib/constants/medicineCategories";
import type { Medicine, SortOption } from "../types";
import type { CategoryFilter } from "../components/CategoryFilters";

export interface MedicineFilters {
  category: CategoryFilter;
  search: string;
  sort: SortOption;
  availableOnly: boolean;
}

const SORT_COMPARATORS: Record<SortOption, (a: Medicine, b: Medicine) => number> = {
  nameAsc: (a, b) => a.name.localeCompare(b.name),
  availability: (a, b) => b.stockQuantity - a.stockQuantity,
};

// Pure so it can be unit-tested without a DOM — search, category, and
// availability filters, the chosen sort, then a stable out-of-stock sink so
// unavailable medicines stay browsable but drop to the bottom of the grid.
export function filterAndSortMedicines(medicines: Medicine[], filters: MedicineFilters): Medicine[] {
  const q = filters.search.trim().toLowerCase();

  const filtered = medicines.filter((m) => {
    if (filters.category !== "ALL" && m.category !== filters.category) return false;
    if (filters.availableOnly && m.stockQuantity === 0) return false;
    if (q) {
      const haystack = `${m.name} ${m.caption} ${MEDICINE_CATEGORY_LABEL[m.category]}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(SORT_COMPARATORS[filters.sort]);
  return sorted.sort((a, b) => (a.stockQuantity === 0 ? 1 : 0) - (b.stockQuantity === 0 ? 1 : 0));
}
