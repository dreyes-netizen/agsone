"use client";

import { ALL_TAB } from "@/lib/hooks/useReactionDetails";
import { getVisibleReactionTabs } from "@/lib/helpers/reactionSummary";

/**
 * "All 24  👍 10  ❤️ 6  👏 5  🎉 3" — horizontally scrollable so it stays
 * usable on narrow screens without wrapping. Tabs with a zero count are
 * hidden entirely (a post that never got a 🔥 shouldn't show a "🔥 0" tab).
 */
export function ReactionFilterTabs({
  counts,
  total,
  active,
  onSelect,
}: {
  counts: Record<string, number>;
  total: number;
  active: string;
  onSelect: (tab: string) => void;
}) {
  const visibleEmojis = getVisibleReactionTabs(counts);

  return (
    <div role="tablist" aria-label="Filter by reaction" className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        type="button"
        role="tab"
        aria-selected={active === ALL_TAB}
        onClick={() => onSelect(ALL_TAB)}
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          active === ALL_TAB ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
        }`}
      >
        All {total}
      </button>
      {visibleEmojis.map(({ emoji, label }) => (
        <button
          key={emoji}
          type="button"
          role="tab"
          aria-selected={active === emoji}
          onClick={() => onSelect(emoji)}
          aria-label={`${label}, ${counts[emoji]}`}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            active === emoji ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <span aria-hidden="true">{emoji}</span> {counts[emoji]}
        </button>
      ))}
    </div>
  );
}
