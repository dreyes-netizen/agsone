"use client";

import { useState } from "react";
import { Pin, ChevronDown } from "lucide-react";

type PinnedItem = { id: string; title: string | null; authorName: string };

const FILTERS = [
  { label: "All",           value: "ALL",          emoji: "🗂️" },
  { label: "My Department", value: "DEPT_ONLY",     emoji: "🏢" },
  { label: "Announcements", value: "ANNOUNCEMENT",  emoji: "📢" },
  { label: "Shoutouts",     value: "SHOUTOUT",      emoji: "✨" },
  { label: "Achievements",  value: "ACHIEVEMENT",   emoji: "🏆" },
  { label: "Celebrations",  value: "CELEBRATION",   emoji: "🎉" },
  { label: "Polls",         value: "POLL",          emoji: "📊" },
] as const;

export function FeedSidebar({
  activeFilter,
  onFilterChange,
  pinned,
  onJumpToPost,
}: {
  activeFilter: string;
  onFilterChange: (value: string) => void;
  pinned: PinnedItem[];
  onJumpToPost: (id: string) => void;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFilterObj = FILTERS.find((f) => f.value === activeFilter) ?? FILTERS[0];

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-2">
        {/* Mobile: collapsible toggle */}
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="lg:hidden w-full flex items-center justify-between px-2 py-1.5"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <span className="text-base leading-none">{activeFilterObj.emoji}</span>
            {activeFilterObj.label}
          </span>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`} />
        </button>
        {/* Desktop: static label */}
        <p className="hidden lg:block px-2 pt-1 pb-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Filter</p>
        {/* Filter list: always on desktop, toggle on mobile */}
        <div className={`space-y-0.5 ${mobileFiltersOpen ? "block mt-1" : "hidden"} lg:block`}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { onFilterChange(f.value); setMobileFiltersOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeFilter === f.value
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <span className="text-base leading-none">{f.emoji}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pinned announcements ── */}
      {pinned.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-3">
          <p className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-semibold text-amber-600 uppercase tracking-wide">
            <Pin className="w-3 h-3" /> Pinned
          </p>
          <div className="space-y-1">
            {pinned.map((p) => (
              <button
                key={p.id}
                onClick={() => onJumpToPost(p.id)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <p className="text-sm font-medium text-zinc-800 truncate">{p.title ?? "Untitled post"}</p>
                <p className="text-xs text-zinc-400 truncate">{p.authorName}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
