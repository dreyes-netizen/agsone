import type { Listing, FoodSortOption } from "../types";

/** Case-insensitive substring match against title, description, or seller name. */
function matchesSearch(listing: Listing, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    listing.title.toLowerCase().includes(q) ||
    (listing.description?.toLowerCase().includes(q) ?? false) ||
    listing.createdBy.displayName.toLowerCase().includes(q)
  );
}

export function filterAndSortListings(
  listings: Listing[],
  opts: { search: string; department: string | null; sort: FoodSortOption }
): Listing[] {
  const filtered = listings.filter((l) => {
    if (!matchesSearch(l, opts.search)) return false;
    if (opts.department !== null && l.createdBy.department?.name !== opts.department) return false;
    return true;
  });

  const sorted = [...filtered];
  switch (opts.sort) {
    case "cutoffSoonest":
      sorted.sort((a, b) => new Date(a.cutoffAt).getTime() - new Date(b.cutoffAt).getTime());
      break;
    case "newest":
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "priceLow":
      sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      break;
    case "priceHigh":
      sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      break;
  }
  return sorted;
}

/** Sorted, unique, non-null department names present among the given listings. */
export function getDepartmentOptions(listings: Listing[]): string[] {
  const names = new Set<string>();
  for (const l of listings) {
    const name = l.createdBy.department?.name;
    if (name) names.add(name);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
