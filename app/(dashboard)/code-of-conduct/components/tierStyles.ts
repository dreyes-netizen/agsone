// Presentational-only severity styling for offense tiers, keyed by position
// (not by tier.key) so it keeps working if tiers are ever reordered/renamed
// in the admin editor — the underlying policy label/content is untouched.
const SEVERITY_STYLES = [
  { badgeClass: "bg-amber-100 text-amber-700", ringClass: "focus-visible:ring-amber-500" },
  { badgeClass: "bg-orange-100 text-orange-700", ringClass: "focus-visible:ring-orange-500" },
  { badgeClass: "bg-rose-100 text-rose-700", ringClass: "focus-visible:ring-rose-500" },
] as const;

export function tierStyle(index: number) {
  return SEVERITY_STYLES[index % SEVERITY_STYLES.length];
}

// "Minor Offenses" -> "Minor". Falls back to the full label if it doesn't
// follow the "<Classification> Offenses" convention.
export function tierClassification(label: string): string {
  return label.replace(/\s+Offenses$/i, "");
}
