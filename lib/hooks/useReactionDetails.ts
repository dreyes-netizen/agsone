"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import type { ReactorItem } from "@/lib/types/feed";

export const ALL_TAB = "ALL";

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
 * cursor-paginated reactor list from GET /api/feed/[id]/reactions, one page
 * per active filter tab (cached so switching tabs back and forth doesn't
 * re-fetch). Lives outside useFeedActions — the feed page is already the
 * largest file in the repo and this state is only relevant while the modal
 * is open, so it doesn't belong threaded through the main feed hook.
 *
 * `syncCurrentUserReaction` lets the caller keep an already-open modal in
 * sync when the user changes their reaction via the main ReactionBar button
 * (outside the modal) — it patches every cached tab in place instead of
 * re-fetching, matching the optimistic-UI pattern used elsewhere in the feed.
 */
export function useReactionDetails(postId: string | null) {
  const { apiFetch } = useApiClient();

  // Resetting local state when `postId` changes is done during render
  // (React's documented pattern for "adjusting state when a prop changes")
  // rather than in an effect, so opening a different post's modal starts
  // clean without an extra render or a synchronous setState-in-effect.
  const [trackedPostId, setTrackedPostId] = useState(postId);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [cache, setCache] = useState<Record<string, TabCache>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  if (postId !== trackedPostId) {
    setTrackedPostId(postId);
    setCache({});
    setActiveTab(ALL_TAB);
    setCounts({});
    setTotal(0);
    setError(null);
  }

  const fetchTab = useCallback(async (forPostId: string, tab: string, cursor?: string, opts: { more?: boolean } = {}) => {
    const seq = ++requestSeq.current;
    if (opts.more) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab !== ALL_TAB) params.set("emoji", tab);
      if (cursor) params.set("cursor", cursor);
      const res = await apiFetch<{ data: { counts: Record<string, number>; total: number; reactors: ReactorItem[] }; nextCursor: string | null }>(
        `/api/feed/${forPostId}/reactions?${params.toString()}`
      );
      if (seq !== requestSeq.current) return; // stale response (tab/post switched again mid-flight)
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

  // Fetch whenever the active tab isn't cached yet — covers both the initial
  // "All" load when a post's modal opens and switching to an unseen tab. The
  // actual fetch is kicked off from inside a .then() callback rather than
  // called directly: fetchTab's very first lines set loading/error state,
  // and calling it synchronously from the effect body itself is exactly what
  // react-hooks/set-state-in-effect flags. Deferring into a promise
  // continuation is a one-microtask, imperceptible delay.
  useEffect(() => {
    if (!postId) return;
    if (cache[activeTab]?.loaded) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchTab(postId, activeTab); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, activeTab, fetchTab]);

  function selectTab(tab: string) {
    setActiveTab(tab);
  }

  function loadMore() {
    if (!postId || loadingMore) return;
    const tab = cache[activeTab];
    if (!tab?.nextCursor) return;
    fetchTab(postId, activeTab, tab.nextCursor, { more: true });
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
