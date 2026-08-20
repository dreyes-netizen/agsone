"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import type { ReactorItem } from "@/lib/types/feed";

export const ALL_TAB = "ALL";

/**
 * Identifies which reactions endpoint is open. `key` is whatever uniquely
 * identifies the target (a post id, or `postId:commentId` for a comment) —
 * used only to detect "the open target changed" so cached tabs reset. `url`
 * is the full reactions endpoint to fetch.
 */
export type ReactionTarget = { key: string; url: string } | null;

type TabCache = {
  items: ReactorItem[];
  nextCursor: string | null;
  loaded: boolean;
};

type CurrentUserMeta = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  department: string | null;
};

/**
 * Backs the reaction-details modal: fetches per-emoji counts + a
 * cursor-paginated reactor list from `target.url`, one page per active
 * filter tab (cached so switching tabs back and forth doesn't re-fetch).
 * Generalized over `target` rather than a bare post id so the same modal
 * backs both GET /api/feed/[id]/reactions (posts) and
 * GET /api/feed/[id]/comments/[commentId]/reactions (comments).
 *
 * `syncCurrentUserReaction` lets the caller keep an already-open modal in
 * sync when the user changes their reaction via the main ReactionBar button
 * (outside the modal) — it patches every cached tab in place instead of
 * re-fetching, matching the optimistic-UI pattern used elsewhere in the feed.
 */
export function useReactionDetails(target: ReactionTarget) {
  const { apiFetch } = useApiClient();

  // Resetting local state when the target changes is done during render
  // (React's documented pattern for "adjusting state when a prop changes")
  // rather than in an effect, so opening a different target's modal starts
  // clean without an extra render or a synchronous setState-in-effect.
  const [trackedKey, setTrackedKey] = useState(target?.key ?? null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [cache, setCache] = useState<Record<string, TabCache>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  if ((target?.key ?? null) !== trackedKey) {
    setTrackedKey(target?.key ?? null);
    setCache({});
    setActiveTab(ALL_TAB);
    setCounts({});
    setTotal(0);
    setError(null);
  }

  const fetchTab = useCallback(async (url: string, tab: string, cursor?: string, opts: { more?: boolean } = {}) => {
    const seq = ++requestSeq.current;
    if (opts.more) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab !== ALL_TAB) params.set("emoji", tab);
      if (cursor) params.set("cursor", cursor);
      const res = await apiFetch<{ data: { counts: Record<string, number>; total: number; reactors: ReactorItem[] }; nextCursor: string | null }>(
        `${url}?${params.toString()}`
      );
      if (seq !== requestSeq.current) return; // stale response (tab/target switched again mid-flight)
      setCounts(res.data.counts);
      setTotal(res.data.total);
      setCache((prev) => {
        const existing = opts.more ? prev[tab]?.items ?? [] : [];
        return { ...prev, [tab]: { items: [...existing, ...res.data.reactors], nextCursor: res.nextCursor, loaded: true } };
      });
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error ? err.message : "Failed to load reactions");
    } finally {
      if (seq === requestSeq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [apiFetch]);

  // Fetch whenever the active tab isn't cached yet. Depends on target?.key
  // and target?.url (primitives), NOT `target` itself — the caller
  // reconstructs a fresh `{key,url}` object literal every render, and
  // depending on that object's identity would re-run this effect (and
  // re-fetch) on every unrelated re-render of the feed page.
  useEffect(() => {
    if (!target) return;
    if (cache[activeTab]?.loaded) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchTab(target.url, activeTab); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key, target?.url, activeTab, fetchTab]);

  function selectTab(tab: string) {
    setActiveTab(tab);
  }

  function loadMore() {
    if (!target || loadingMore) return;
    const tab = cache[activeTab];
    if (!tab?.nextCursor) return;
    fetchTab(target.url, activeTab, tab.nextCursor, { more: true });
  }

  // Patch every already-loaded tab in place: drop the user's row from
  // wherever it was, add it back under the new emoji (if any). Tabs that
  // haven't been fetched yet don't need patching — they'll come back correct
  // on first fetch.
  function syncCurrentUserReaction(prevEmoji: string | null, nextEmoji: string | null, me: CurrentUserMeta) {
    setCache((prev) => {
      const next: Record<string, TabCache> = {};
      for (const [tab, tabCache] of Object.entries(prev)) {
        if (!tabCache.loaded) { next[tab] = tabCache; continue; }
        let items = tabCache.items.filter((r) => !r.isCurrentUser);
        const belongsHere = nextEmoji && (tab === ALL_TAB || tab === nextEmoji);
        if (belongsHere && nextEmoji) {
          items = [
            { id: `optimistic-${me.id}`, emoji: nextEmoji, createdAt: new Date().toISOString(), isCurrentUser: true, user: me },
            ...items,
          ];
        }
        next[tab] = { ...tabCache, items };
      }
      return next;
    });
    setCounts((prev) => {
      const next = { ...prev };
      if (prevEmoji) next[prevEmoji] = Math.max(0, (next[prevEmoji] ?? 1) - 1);
      if (nextEmoji) next[nextEmoji] = (next[nextEmoji] ?? 0) + 1;
      return next;
    });
    setTotal((prev) => prev + (nextEmoji ? 1 : 0) - (prevEmoji ? 1 : 0));
  }

  const activeItems = cache[activeTab]?.items ?? [];
  const hasMore = !!cache[activeTab]?.nextCursor;

  return {
    counts, total, activeTab, selectTab, items: activeItems,
    loading, loadingMore, hasMore, loadMore, error,
    syncCurrentUserReaction,
  };
}
