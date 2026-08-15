"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

import type { Reward, Redemption, SortOption, MarketplaceView } from "./types";
import { MarketplaceHeader } from "./components/MarketplaceHeader";
import { MarketplaceTabs } from "./components/MarketplaceTabs";
import { MarketplaceToolbar } from "./components/MarketplaceToolbar";
import { CategoryFilters, type CategoryFilter } from "./components/CategoryFilters";
import { RewardGrid } from "./components/RewardGrid";
import { RewardDetailDialog } from "./components/RewardDetailDialog";
import { MyRequestsView } from "./components/MyRequestsView";
import { RequestDetailDialog } from "./components/RequestDetailDialog";
import { filterAndSortRewards } from "./lib/filterRewards";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

function readUrlState() {
  const sp = new URLSearchParams(window.location.search);
  const tab = sp.get("tab") === "requests" ? "requests" : "browse";
  const category = (sp.get("category") ?? "ALL") as CategoryFilter;
  const q = sp.get("q") ?? "";
  const sort = (sp.get("sort") ?? "recommended") as SortOption;
  const available = sp.get("available") === "1";
  const afford = sp.get("afford") === "1";
  return { tab: tab as MarketplaceView, category, q, sort, available, afford };
}

export default function MarketplacePage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const { fire: fireConfetti } = useConfetti();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  const serverBalance = dbUser?.pointsBalance ?? 0;
  const [balanceState, setBalanceState] = useState({ server: serverBalance, display: serverBalance });
  // Preserve immediate optimistic feedback after a redemption, then adopt the
  // authoritative AuthProvider balance as soon as the points broadcast lands.
  if (balanceState.server !== serverBalance) {
    setBalanceState({ server: serverBalance, display: serverBalance });
  }
  const balance = balanceState.display;

  const [view, setView] = useState<MarketplaceView>("browse");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recommended");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [affordableOnly, setAffordableOnly] = useState(false);

  // Hydrate from the URL once on mount (client-only — safe from the SSR
  // pass). Deferred a microtask so these setState calls don't run
  // synchronously inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => {
      const s = readUrlState();
      setView(s.tab);
      setCategory(s.category);
      setSearch(s.q);
      setSort(s.sort);
      setAvailableOnly(s.available);
      setAffordableOnly(s.afford);
    });
  }, []);

  // Keep the URL in sync for deep-linking/back-forward, without a Next.js
  // navigation (no scroll reset, no server round-trip).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (view !== "browse") sp.set("tab", view);
    if (category !== "ALL") sp.set("category", category);
    if (search) sp.set("q", search);
    if (sort !== "recommended") sp.set("sort", sort);
    if (availableOnly) sp.set("available", "1");
    if (affordableOnly) sp.set("afford", "1");
    const qs = sp.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [view, category, search, sort, availableOnly, affordableOnly]);

  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [confirmOnOpen, setConfirmOnOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  const loadRedemptions = useCallback(async () => {
    setRedemptionsLoading(true);
    try {
      const r = await apiFetch<{ data: Redemption[] }>("/api/redemptions?limit=100");
      setRedemptions(r.data);
    } catch {
      // fetch failed — redemptions list stays empty; apiFetch throws with user-facing message if needed
    } finally {
      setRedemptionsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRewards() {
    try {
      const rewardsRes = await apiFetch<{ data: Reward[] }>("/api/rewards?limit=100");
      setRewards(rewardsRes.data);
    } catch {
      // Keep the last known catalog if a transient refresh fails.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(loadRewards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (view === "requests" && !authLoading && user) queueMicrotask(loadRedemptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, authLoading, user]);

  useRealtimeChannel(realtimeTopics.rewards, loadRewards, { debounceMs: 200 });
  useRealtimeChannel(
    dbUser ? realtimeTopics.redemptionsUser(dbUser.id) : null,
    () => {
      if (view === "requests") loadRedemptions();
    },
    { debounceMs: 200 },
  );

  function openReward(reward: Reward, startConfirming = false) {
    setSelectedReward(reward);
    setConfirmOnOpen(startConfirming);
  }
  function closeReward() {
    setSelectedReward(null);
    setConfirmOnOpen(false);
  }

  async function handleSubmitRequest(reward: Reward) {
    await apiFetch("/api/redemptions", { method: "POST", body: JSON.stringify({ rewardId: reward.id }) });
    setBalanceState((current) => ({ ...current, display: current.display - reward.pointCost }));
    fireConfetti();
    loadRedemptions();
  }

  const categoryCounts = useMemo(
    () =>
      rewards.reduce<Record<string, number>>((acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + 1;
        return acc;
      }, {}),
    [rewards],
  );

  const hasActiveFilters = search.trim() !== "" || category !== "ALL" || availableOnly || affordableOnly;

  function clearFilters() {
    setSearch("");
    setCategory("ALL");
    setAvailableOnly(false);
    setAffordableOnly(false);
  }

  const visibleRewards = useMemo(
    () => filterAndSortRewards(rewards, { category, search, sort, availableOnly, affordableOnly, balance }),
    [rewards, category, search, sort, availableOnly, affordableOnly, balance],
  );

  return (
    <div className="space-y-5">
      <MarketplaceHeader balance={balance} />

      <MarketplaceTabs view={view} onChange={setView} requestCount={redemptions.length} />

      {view === "browse" && (
        <div id="panel-browse" role="tabpanel" aria-labelledby="tab-browse" className="space-y-4">
          <MarketplaceToolbar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            availableOnly={availableOnly}
            onAvailableOnlyChange={setAvailableOnly}
            affordableOnly={affordableOnly}
            onAffordableOnlyChange={setAffordableOnly}
          />

          <CategoryFilters
            active={category}
            counts={categoryCounts}
            total={rewards.length}
            loading={loading}
            onChange={(c) => setCategory(c as CategoryFilter)}
          />

          <RewardGrid
            loading={loading}
            rewards={visibleRewards}
            balance={balance}
            onOpen={(r: Reward) => openReward(r)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </div>
      )}

      {view === "requests" && (
        <div id="panel-requests" role="tabpanel" aria-labelledby="tab-requests" className="space-y-3">
          <MyRequestsView loading={redemptionsLoading} redemptions={redemptions} onOpenDetail={setSelectedRedemption} />
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={!!lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <RewardDetailDialog
        key={selectedReward?.id}
        reward={selectedReward}
        balance={balance}
        startConfirming={confirmOnOpen}
        onClose={closeReward}
        onZoom={(images, index) => setLightbox({ images, index })}
        onSubmit={handleSubmitRequest}
        onViewRequests={() => {
          closeReward();
          setView("requests");
        }}
      />

      <RequestDetailDialog redemption={selectedRedemption} onClose={() => setSelectedRedemption(null)} />
    </div>
  );
}
