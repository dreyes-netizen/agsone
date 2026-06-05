"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Pin } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";

type Employee = { id: string; displayName: string; avatarUrl: string | null };

type PinnedItem = { id: string; title: string | null; authorName: string };

const FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Updates", value: "UPDATE" },
  { label: "Shoutouts", value: "SHOUTOUT" },
] as const;

export function FeedSidebar({
  activeFilter,
  onFilterChange,
  employees,
  onShoutoutCreated,
  pinned,
  onJumpToPost,
}: {
  activeFilter: string;
  onFilterChange: (value: string) => void;
  employees: Employee[];
  onShoutoutCreated: (post: unknown) => void;
  pinned: PinnedItem[];
  onJumpToPost: (id: string) => void;
}) {
  const { apiFetch } = useApiClient();

  // ── Give Shoutout form state (owned here) ──
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function resetForm() {
    setContent("");
    setRecipientId("");
    setRecipientName("");
    setSearch("");
    setSearchOpen(false);
  }

  async function submit() {
    if (!recipientId || !content.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: unknown }>("/api/feed", {
        method: "POST",
        body: JSON.stringify({ type: "SHOUTOUT", content: content.trim(), recipientId }),
      });
      onShoutoutCreated(res.data);
      resetForm();
      setOpen(false);
    } catch {
      // silent — caller's list is unchanged on failure
    } finally {
      setSubmitting(false);
    }
  }

  const filteredEmployees = employees.filter((e) =>
    e.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-2">
        <p className="px-2 pt-1 pb-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Filter</p>
        <div className="space-y-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === f.value
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Give Shoutout ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-700">Recognize a colleague</span>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Shoutout
          </button>
        </div>

        {open && (
          <div className="px-4 pb-4 border-t border-zinc-100 pt-3 space-y-3">
            <div ref={searchRef} className="relative">
              {recipientId ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-amber-800 font-medium flex-1 truncate">{recipientName}</span>
                  <button
                    type="button"
                    onClick={() => { setRecipientId(""); setRecipientName(""); setSearch(""); }}
                    className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search colleague…"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
                />
              )}
              {searchOpen && !recipientId && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredEmployees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setRecipientId(e.id);
                        setRecipientName(e.displayName);
                        setSearch("");
                        setSearchOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                    >
                      {e.displayName}
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="px-3 py-2 text-sm text-zinc-400">No results</p>
                  )}
                </div>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What did they do that deserves recognition?"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{content.length}/500</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setOpen(false); resetForm(); }}
                  className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting || !recipientId || !content.trim()}
                  className="text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
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
