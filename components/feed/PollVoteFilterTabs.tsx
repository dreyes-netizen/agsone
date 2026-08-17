"use client";

import { ALL_TAB } from "@/lib/hooks/usePollVoters";
import type { PollOption } from "@/lib/types/feed";

/**
 * "All 12  ITLOG 7  WFH 5" — horizontally scrollable so it stays usable on
 * narrow screens without wrapping. Unlike ReactionFilterTabs, every option
 * gets a tab regardless of count: a poll's options are fixed and few (2-4),
 * so hiding a zero-vote option would just be confusing rather than tidying
 * up a long dynamic list the way it does for reactions.
 */
export function PollVoteFilterTabs({
  options,
  counts,
  total,
  active,
  onSelect,
}: {
  options: PollOption[];
  counts: Record<string, number>;
  total: number;
  active: string;
  onSelect: (tab: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Filter by option" className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
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
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={active === opt.id}
          onClick={() => onSelect(opt.id)}
          title={opt.text}
          aria-label={`${opt.text}, ${counts[opt.id] ?? 0}`}
          className={`shrink-0 max-w-[10rem] flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            active === opt.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <span className="truncate">{opt.text}</span> {counts[opt.id] ?? 0}
        </button>
      ))}
    </div>
  );
}
