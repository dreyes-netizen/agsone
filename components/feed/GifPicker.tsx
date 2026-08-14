"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { searchGifs, trendingGifs, seedGifCache, type GifResult } from "@/lib/giphy/client";

type Status = "ready" | "empty" | "unconfigured" | "error";
type Fetched = { key: string | null; status: Status; results: GifResult[] };

/**
 * Compact GIF search — reuses the same Dialog primitive as
 * ReactionDetailsDialog (this app has no Popover/Sheet component yet, and a
 * modal that's already sized down to max-w-sm/max-h-[70vh] covers the "small
 * modal, not a huge dialog" requirement on both desktop and mobile without
 * adding a new UI dependency). Escape/outside-click-close come for free from
 * the underlying Radix Dialog. Debounced 400ms so typing doesn't burn
 * through GIPHY's rate-limited key one keystroke at a time.
 */
export function GifPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 400);
  // "loading" is derived (fetchKey !== the key we've actually fetched for)
  // rather than stored, so the effect never needs to setState synchronously
  // at the top of its body before the async call resolves.
  const fetchKey = open ? debouncedQuery : null;
  const [fetched, setFetched] = useState<Fetched>({ key: null, status: "empty", results: [] });
  const isLoading = open && fetched.key !== fetchKey;

  useEffect(() => {
    if (!open) return;
    const key = debouncedQuery;
    const fetcher = key ? searchGifs(key) : trendingGifs();
    fetcher.then((res) => {
      if (!res.ok) {
        setFetched({ key, status: res.reason, results: [] });
        return;
      }
      setFetched({ key, status: res.results.length === 0 ? "empty" : "ready", results: res.results });
    });
  }, [open, debouncedQuery]);

  function closeAndReset() {
    setQuery("");
    onClose();
  }

  function handleSelect(gif: GifResult) {
    seedGifCache(gif);
    onSelect(gif);
    closeAndReset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeAndReset(); }}>
      <DialogContent className="max-w-sm p-0 gap-0 max-h-[70vh] flex flex-col">
        <DialogHeader className="p-3 pb-2 border-b border-gray-100 space-y-0">
          <DialogTitle className="sr-only">Search GIFs</DialogTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIFs…"
              aria-label="Search GIFs"
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Searching…</span>
            </div>
          )}
          {!isLoading && (fetched.status === "unconfigured" || fetched.status === "error") && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-gray-500">
              <AlertCircle className="w-5 h-5 text-gray-400" aria-hidden="true" />
              GIFs are temporarily unavailable.
            </div>
          )}
          {!isLoading && fetched.status === "empty" && (
            <p className="py-10 text-center text-sm text-gray-500">No GIFs found. Try another search.</p>
          )}
          {!isLoading && fetched.status === "ready" && (
            <div className="grid grid-cols-2 gap-1.5">
              {fetched.results.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleSelect(gif)}
                  aria-label={gif.altText}
                  className="relative overflow-hidden rounded-lg bg-gray-100 aspect-video focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF; next/image would strip animation frames */}
                  <img src={gif.thumbUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-gray-100 text-center">
          <span className="text-[10px] font-semibold tracking-wide text-gray-400">GIFs powered by GIPHY</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
