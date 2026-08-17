"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import type { VoterItem } from "@/lib/types/feed";

export const ALL_TAB = "ALL";

type TabCache = {
  items: VoterItem[];
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
 * Backs the poll voter-list modal: fetches per-option counts + a
 * cursor-paginated voter list from GET /api/feed/[id]/voters, one page per
 * active filter tab (cached so switching tabs back and forth doesn't
 * re-fetch). Mirrors useReactionDetails exactly, swapping "emoji" for
 * "poll option".
 *
 * `syncCurrentUserVote` lets the caller keep an already-open modal in sync
 * when the user changes their vote via PollBlock (outside the modal) — it
 * patches every cached tab in place instead of re-fetching.
 */
export function usePollVoters(postId: string | null) {
  const { apiFetch } = useApiClient();

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
      if (tab !== ALL_TAB) params.set("option", tab);
      if (cursor) params.set("cursor", cursor);
      const res = await apiFetch<{ data: { counts: Record<string, number>; total: number; voters: VoterItem[] }; nextCursor: string | null }>(
        `/api/feed/${forPostId}/voters?${params.toString()}`
      );
      if (seq !== requestSeq.current) return; // stale response (tab/post switched again mid-flight)
      setCounts(res.data.counts);
      setTotal(res.data.total);
      setCache((prev) => {
        const existing = opts.more ? prev[tab]?.items ?? [] : [];
        return { ...prev, [tab]: { items: [...existing, ...res.data.voters], nextCursor: res.nextCursor, loaded: true } };
      });
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error ? err.message : "Failed to load voters");
    } finally {
      if (seq === requestSeq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [apiFetch]);

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

  function syncCurrentUserVote(prevOptionId: string | null, nextOptionId: string | null, optionText: string | null, me: CurrentUserMeta) {
    setCache((prev) => {
      const next: Record<string, TabCache> = {};
      for (const [tab, tabCache] of Object.entries(prev)) {
        if (!tabCache.loaded) { next[tab] = tabCache; continue; }
        let items = tabCache.items.filter((v) => !v.isCurrentUser);
        const belongsHere = nextOptionId && (tab === ALL_TAB || tab === nextOptionId);
        if (belongsHere && nextOptionId && optionText) {
          items = [
            { id: `optimistic-${me.id}`, optionId: nextOptionId, optionText, createdAt: new Date().toISOString(), isCurrentUser: true, user: me },
            ...items,
          ];
        }
        next[tab] = { ...tabCache, items };
      }
      return next;
    });
    setCounts((prev) => {
      const next = { ...prev };
      if (prevOptionId) next[prevOptionId] = Math.max(0, (next[prevOptionId] ?? 1) - 1);
      if (nextOptionId) next[nextOptionId] = (next[nextOptionId] ?? 0) + 1;
      return next;
    });
    setTotal((prev) => prev + (nextOptionId ? 1 : 0) - (prevOptionId ? 1 : 0));
  }

  const activeItems = cache[activeTab]?.items ?? [];
  const hasMore = !!cache[activeTab]?.nextCursor;

  return {
    counts, total, activeTab, selectTab, items: activeItems,
    loading, loadingMore, hasMore, loadMore, error,
    syncCurrentUserVote,
  };
}
