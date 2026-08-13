import { REACTIONS } from "@/lib/constants/reactions";

/**
 * Pure helpers for the reaction summary line and filter tabs — pulled out
 * of PostEngagement/ReactionFilterTabs so the calculation is unit-testable
 * without rendering React (component/integration testing is currently
 * blocked project-wide, see project overview in CLAUDE.md).
 */

export function getReactionSummary(reactions: Record<string, number>): { total: number; topEmojis: string[] } {
  const total = Object.values(reactions).reduce((a, b) => a + b, 0);
  const topEmojis = Object.entries(reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emoji]) => emoji);
  return { total, topEmojis };
}

/** Reaction types with at least one reaction, in the app's fixed display order — zero-count types are hidden. */
export function getVisibleReactionTabs(counts: Record<string, number>): { emoji: string; label: string }[] {
  return REACTIONS.filter((r) => (counts[r.emoji] ?? 0) > 0);
}
