import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";

// Employees search by offense, not by category — so a match is either the
// tier's own label (e.g. typing "grave") or one of its example offenses.
export function matchingExamples(tier: CodeOfConduct["tiers"][number], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return tier.examples;
  return tier.examples.filter((ex) => ex.toLowerCase().includes(q));
}

export function tierMatchesQuery(tier: CodeOfConduct["tiers"][number], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return tier.label.toLowerCase().includes(q) || matchingExamples(tier, query).length > 0;
}
