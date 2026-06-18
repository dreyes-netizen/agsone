"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import React from "react";
import {
  ShoppingBag, CheckCircle, AlertCircle, Coins,
  Package, Ticket, Star, Monitor,
  X, ChevronLeft, ChevronRight,
  Clock, Receipt, AlertTriangle, Loader2,
} from "lucide-react";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { ImageLightbox } from "@/components/ImageLightbox";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  pointCost: number;
  stockQuantity: number;
  category: string;
};

type Redemption = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";
  pointsSpent: number;
  adminNote: string | null;
  createdAt: string;
  reward: { name: string; pointCost: number; category: string };
};

const categoryConfig: Record<string, { icon: React.ElementType; iconClass: string; label: string; accent: string; badge: string }> = {
  PHYSICAL:  { icon: Package,  iconClass: "text-orange-600", label: "Physical",  accent: "from-orange-400 to-amber-400",  badge: "bg-orange-50 text-orange-700 border-orange-200" },
  VOUCHER:   { icon: Ticket,   iconClass: "text-blue-600",   label: "Voucher",   accent: "from-blue-500 to-cyan-400",     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  PRIVILEGE: { icon: Star,     iconClass: "text-indigo-600", label: "Privilege", accent: "from-indigo-500 to-blue-500",  badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  DIGITAL:   { icon: Monitor,  iconClass: "text-emerald-600",label: "Digital",   accent: "from-emerald-500 to-teal-400",  badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING:   { label: "Pending",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:  { label: "Approved",  className: "bg-blue-50 text-blue-700 border-blue-200" },
  FULFILLED: { label: "Fulfilled", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED:  { label: "Rejected",  className: "bg-red-50 text-red-700 border-red-200" },
};

const LOW_STOCK_THRESHOLD = 3;

export default function MarketplacePage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const { fire: fireConfetti } = useConfetti();
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedRewardImageIndex, setSelectedRewardImageIndex] = useState(0);
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const [view, setView] = useState<"browse" | "requests">("browse");
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  const loadRedemptions = useCallback(async () => {
    setRedemptionsLoading(true);
    try {
      const r = await apiFetch<{ data: Redemption[] }>("/api/redemptions");
      setRedemptions(r.data);
    } catch {
      // fetch failed — redemptions list stays empty; apiFetch throws with user-facing message if needed
    } finally {
      setRedemptionsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([
      apiFetch<{ data: Reward[] }>("/api/rewards"),
      apiFetch<{ data: { pointsBalance: number } }>("/api/me"),
    ])
      .then(([rewardsRes, meRes]) => {
        setRewards(rewardsRes.data);
        setBalance(meRes.data.pointsBalance);
      })
      .catch(() => { /* fetch failed — rewards/balance stay at defaults */ })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (view === "requests" && !authLoading && user) loadRedemptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, authLoading, user]);

  function openModal(reward: Reward, startConfirming = false) {
    setSelectedReward(reward);
    setSelectedRewardImageIndex(cardImageIndices[reward.id] ?? 0);
    setConfirming(startConfirming);
  }

  function closeModal() {
    setSelectedReward(null);
    setConfirming(false);
  }

  async function handleRedeem(reward: Reward) {
    setRedeeming(reward.id);
    setToast(null);
    try {
      await apiFetch("/api/redemptions", { method: "POST", body: JSON.stringify({ rewardId: reward.id }) });
      setBalance((b) => b - reward.pointCost);
      closeModal();
      setToast({ type: "success", msg: `"${reward.name}" redeemed! Pending HR approval.` });
      fireConfetti();
      loadRedemptions();
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed to redeem" });
      setConfirming(false);
    } finally {
      setRedeeming(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const categories = ["ALL", "PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"];

  const categoryCounts = rewards.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  // Filter then sort: out-of-stock sinks to the bottom
  const sorted = rewards
    .filter((r) => filter === "ALL" || r.category === filter)
    .sort((a, b) => (a.stockQuantity === 0 ? 1 : 0) - (b.stockQuantity === 0 ? 1 : 0));

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Marketplace</h1>
          <p className="text-zinc-500 text-sm mt-1">Spend your points on something nice</p>
        </div>
        <div className="flex items-center gap-2 bg-[#111827] text-white px-3.5 py-2 rounded-lg shadow-sm">
          <Coins className="w-4 h-4 text-navy-200" />
          <span className="font-bold text-sm tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-navy-300 text-xs">pts</span>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200 ${
          toast.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />}
          {toast.msg}
        </div>
      )}

      {/* ── View tabs ── */}
      <div role="tablist" aria-label="Marketplace views" className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
        <button
          role="tab"
          aria-selected={view === "browse"}
          aria-controls="panel-browse"
          onClick={() => setView("browse")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#111827] ${
            view === "browse" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-800"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Browse
        </button>
        <button
          role="tab"
          aria-selected={view === "requests"}
          aria-controls="panel-requests"
          onClick={() => setView("requests")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#111827] ${
            view === "requests" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-800"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          My Requests
        </button>
      </div>

      {/* ── Browse view ── */}
      {view === "browse" && (
        <div id="panel-browse" role="tabpanel">
          {/* Category filters — wraps on all screen sizes, no overflow */}
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2 mb-5">
            {categories.map((cat) => {
              const config = categoryConfig[cat];
              const active = filter === cat;
              const count = cat === "ALL" ? rewards.length : (categoryCounts[cat] ?? 0);
              // Keep empty categories visible but disabled so the UI stays stable
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  aria-pressed={active}
                  disabled={count === 0 && cat !== "ALL"}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111827] ${
                    count === 0 && cat !== "ALL"
                      ? "opacity-40 cursor-not-allowed bg-white border-zinc-200 text-zinc-500"
                      : active
                      ? "bg-[#111827] text-white border-[#111827]"
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {cat !== "ALL" && <config.icon className={`w-3.5 h-3.5 ${active ? "text-white" : config.iconClass}`} aria-hidden="true" />}
                  {cat === "ALL" ? "All Rewards" : config.label}
                  {!loading && (
                    <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-zinc-500"}`} aria-label={`${count} items`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Card grid / list ── */}
          {loading ? (
            // Skeleton: single column on mobile, grid on sm+
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-zinc-200 animate-pulse h-[88px] sm:h-64" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-zinc-200">
              <ShoppingBag className="w-10 h-10 text-zinc-200 mb-4" />
              <p className="text-zinc-600 font-medium">No rewards here yet</p>
              <p className="text-zinc-400 text-sm mt-1">Ask HR to add items to the marketplace.</p>
            </div>
          ) : (
            // Mobile: single-column horizontal list  |  sm+: grid
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {sorted.map((reward) => {
                const cfg = categoryConfig[reward.category] ?? categoryConfig.PHYSICAL;
                const canAfford = balance >= reward.pointCost;
                const outOfStock = reward.stockQuantity === 0;
                const lowStock = !outOfStock && reward.stockQuantity > 0 && reward.stockQuantity <= LOW_STOCK_THRESHOLD;
                const busy = redeeming === reward.id;
                const images = reward.imageUrls ?? [];
                const idx = cardImageIndices[reward.id] ?? 0;
                const setIdx = (i: number) => setCardImageIndices((prev) => ({ ...prev, [reward.id]: i }));
                const deficit = reward.pointCost - balance;

                return (
                  <div
                    key={reward.id}
                    onClick={() => openModal(reward)}
                    className={`bg-white rounded-xl border overflow-hidden cursor-pointer hover:shadow-md transition-shadow motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform motion-safe:[transition-timing-function:cubic-bezier(0.25,1,0.5,1)]
                      flex flex-row items-center
                      sm:flex-col sm:items-stretch
                      ${outOfStock ? "opacity-55 border-zinc-200" : !canAfford ? "opacity-70 border-amber-200" : "border-zinc-200"}`}
                  >
                    {/* ── Image / accent ── */}
                    {images.length > 0 ? (
                      <div
                        className="relative group shrink-0
                          w-[88px] h-[88px]
                          sm:w-full sm:h-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={images[idx]}
                          alt={reward.name}
                          className="w-full h-full object-contain bg-zinc-50 cursor-zoom-in sm:aspect-square"
                          onClick={() => setLightbox({ images, index: idx })}
                        />
                        {/* Low-stock badge */}
                        {lowStock && (
                          <span className="absolute top-1.5 left-1.5 bg-red-500 text-white font-bold rounded-full shadow-sm
                            text-[9px] px-1.5 py-px
                            sm:text-xs sm:px-2 sm:py-0.5 sm:top-2 sm:left-2">
                            Only {reward.stockQuantity} left!
                          </span>
                        )}
                        {/* Carousel arrows */}
                        {images.length > 1 && (
                          <div className="hidden sm:block">
                            <button
                              aria-label="Previous image"
                              onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + images.length) % images.length); }}
                              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              aria-label="Next image"
                              onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % images.length); }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                              {images.map((_, i) => (
                                <button
                                  key={i}
                                  aria-label={`Image ${i + 1} of ${images.length}`}
                                  aria-current={i === idx ? "true" : undefined}
                                  onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                                  className={`w-2 h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${i === idx ? "bg-white" : "bg-white/50"}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Mobile: thin left accent stripe  |  Desktop: square gradient placeholder
                      <>
                        <div className={`shrink-0 self-stretch w-1.5 bg-gradient-to-b sm:hidden ${cfg.accent}`} />
                        <div className={`hidden sm:flex sm:w-full sm:aspect-square sm:bg-gradient-to-br sm:items-center sm:justify-center ${cfg.accent}`}>
                          <cfg.icon className="w-12 h-12 text-white/70" />
                        </div>
                      </>
                    )}

                    {/* ── Content ── */}
                    <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-5 gap-1.5 sm:gap-3">

                      {/* Desktop only: icon + badge row */}
                      <div className="hidden sm:flex items-start justify-between">
                        <cfg.icon className={`w-7 h-7 ${cfg.iconClass}`} />
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Name row — badge shown inline on mobile */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-zinc-900 leading-snug line-clamp-2
                          text-sm
                          sm:text-base">
                          {reward.name}
                        </h3>
                        <span className={`sm:hidden shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Description */}
                      {reward.description && (
                        <p className="text-zinc-500 leading-relaxed line-clamp-1 sm:line-clamp-2
                          text-xs
                          sm:text-sm">
                          {reward.description}
                        </p>
                      )}

                      {/* Price + Redeem */}
                      <div className="flex items-center justify-between border-t border-zinc-100 mt-auto
                        pt-2
                        sm:pt-3">
                        <div>
                          <p className={`font-bold tabular-nums leading-none ${canAfford && !outOfStock ? "text-navy-600" : "text-zinc-400"}
                            text-sm
                            sm:text-lg`}>
                            {reward.pointCost.toLocaleString()}
                            <span className="font-medium ml-1 text-xs sm:text-sm">pts</span>
                          </p>
                          {outOfStock ? (
                            <p className="text-xs text-zinc-500 mt-0.5">Out of stock</p>
                          ) : !canAfford ? (
                            <p className="text-xs text-red-500 mt-0.5">Need {deficit.toLocaleString()} more</p>
                          ) : lowStock ? (
                            <p className="text-xs text-red-500 font-medium mt-0.5 hidden sm:block">
                              Only {reward.stockQuantity} left!
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {reward.stockQuantity === -1 ? "Unlimited" : `${reward.stockQuantity} left`}
                            </p>
                          )}
                        </div>
                        <button
                          disabled={!canAfford || outOfStock || busy}
                          aria-label={outOfStock ? `${reward.name} — sold out` : !canAfford ? `${reward.name} — need ${deficit.toLocaleString()} more pts` : `Redeem ${reward.name} for ${reward.pointCost.toLocaleString()} pts`}
                          onClick={(e) => { e.stopPropagation(); openModal(reward, true); }}
                          className={`rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111827]
                            text-xs px-3 py-1.5
                            sm:text-sm sm:px-4 sm:py-2
                            ${outOfStock || !canAfford
                              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                              : "bg-[#111827] text-white hover:bg-gray-800"
                            }`}
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : outOfStock ? "Sold Out" : !canAfford ? "Can't Afford" : "Redeem"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── My Requests view ── */}
      {view === "requests" && (
        <div id="panel-requests" role="tabpanel" className="space-y-3">
          {redemptionsLoading ? (
            <div className="space-y-3" aria-label="Loading requests" aria-busy="true">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-zinc-200 h-20 animate-pulse" />
              ))}
            </div>
          ) : redemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-zinc-200">
              <Receipt className="w-10 h-10 text-zinc-200 mb-4" aria-hidden="true" />
              <p className="text-zinc-600 font-medium">No requests yet</p>
              <p className="text-zinc-500 text-sm mt-1">Redeem a reward and it will appear here.</p>
            </div>
          ) : (
            <ul role="list" className="space-y-3">
              {redemptions.map((r) => {
                const cfg = categoryConfig[r.reward.category] ?? categoryConfig.PHYSICAL;
                const status = statusConfig[r.status];
                return (
                  <li key={r.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4">
                    <cfg.icon className={`w-8 h-8 shrink-0 ${cfg.iconClass}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">{r.reward.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                        <span className="text-xs text-zinc-500">
                          {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="text-xs text-zinc-500" aria-hidden="true">·</span>
                        <span className="text-xs font-medium text-zinc-500 tabular-nums">{r.pointsSpent.toLocaleString()} pts</span>
                      </div>
                      {r.adminNote && r.status === "REJECTED" && (
                        <p className="text-xs text-red-600 mt-1">Note: {r.adminNote}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${status.className}`}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={!!lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ── Product detail modal ── */}
      {selectedReward && (() => {
        const cfg = categoryConfig[selectedReward.category] ?? categoryConfig.PHYSICAL;
        const canAfford = balance >= selectedReward.pointCost;
        const outOfStock = selectedReward.stockQuantity === 0;
        const lowStock = !outOfStock && selectedReward.stockQuantity > 0 && selectedReward.stockQuantity <= LOW_STOCK_THRESHOLD;
        const images = selectedReward.imageUrls ?? [];
        const total = images.length;
        const deficit = selectedReward.pointCost - balance;
        const busy = redeeming === selectedReward.id;

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
            onClick={closeModal}
          >
            {/* Shell: flex-col keeps close button anchored outside the scroll area */}
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reward-modal-title"
              className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col relative animate-in fade-in-0 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle — bottom-sheet affordance on mobile */}
              <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="w-10 h-1 bg-zinc-300 rounded-full" />
              </div>

              <button
                onClick={closeModal}
                aria-label="Close"
                autoFocus
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Scrollable content */}
              <div className="overflow-y-auto scrollbar-hide flex-1 rounded-2xl">
                {total > 0 && (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[selectedRewardImageIndex]}
                      alt={selectedReward.name}
                      className="w-full aspect-square object-contain bg-white rounded-t-2xl cursor-zoom-in"
                      onClick={() => setLightbox({ images, index: selectedRewardImageIndex })}
                    />
                    {lowStock && (
                      <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                        Only {selectedReward.stockQuantity} left!
                      </span>
                    )}
                    {total > 1 && (
                      <>
                        <button
                          aria-label="Previous image"
                          onClick={() => setSelectedRewardImageIndex((i) => (i - 1 + total) % total)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                            opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          aria-label="Next image"
                          onClick={() => setSelectedRewardImageIndex((i) => (i + 1) % total)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                            opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-2">
                          {images.map((_, i) => (
                            <button
                              key={i}
                              aria-label={`Image ${i + 1} of ${total}`}
                              aria-current={i === selectedRewardImageIndex ? "true" : undefined}
                              onClick={() => setSelectedRewardImageIndex(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${i === selectedRewardImageIndex ? "bg-white" : "bg-white/50 hover:bg-white/75"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="p-5 space-y-4">
                  {!confirming && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
                        <span className="text-xs text-zinc-400">
                          {outOfStock ? "Out of stock" : selectedReward.stockQuantity === -1 ? "Unlimited" : `${selectedReward.stockQuantity} left`}
                        </span>
                      </div>
                      <div>
                        <h2 id="reward-modal-title" className="text-xl font-bold text-zinc-900">{selectedReward.name}</h2>
                        {selectedReward.description && (
                          <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap leading-relaxed">{selectedReward.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                        <div>
                          <p className={`font-bold text-lg tabular-nums ${canAfford && !outOfStock ? "text-navy-600" : "text-zinc-400"}`}>
                            {selectedReward.pointCost.toLocaleString()} <span className="text-sm font-medium">pts</span>
                          </p>
                          {!canAfford && !outOfStock && (
                            <p className="text-xs text-red-500 mt-0.5">Need {deficit.toLocaleString()} more pts</p>
                          )}
                        </div>
                        <button
                          disabled={!canAfford || outOfStock}
                          onClick={() => setConfirming(true)}
                          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111827] ${
                            outOfStock || !canAfford
                              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                              : "bg-[#111827] text-white hover:bg-gray-800"
                          }`}
                        >
                          {outOfStock ? "Sold Out" : !canAfford ? "Can't Afford" : "Redeem"}
                        </button>
                      </div>
                    </>
                  )}

                  {confirming && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <h3 className="font-bold text-zinc-900">Confirm Redemption</h3>
                      </div>
                      <div className="bg-zinc-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Reward</span>
                          <span className="font-semibold text-zinc-900 text-right max-w-[60%] leading-snug">{selectedReward.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Cost</span>
                          <span className="font-semibold text-zinc-900 tabular-nums">{selectedReward.pointCost.toLocaleString()} pts</span>
                        </div>
                        <div className="border-t border-zinc-200 my-1" />
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Your balance</span>
                          <span className="text-zinc-700 tabular-nums">{balance.toLocaleString()} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">After redemption</span>
                          <span className="font-bold text-navy-600 tabular-nums">{(balance - selectedReward.pointCost).toLocaleString()} pts</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 text-center">HR will review your request and confirm delivery.</p>
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => setConfirming(false)}
                          disabled={busy}
                          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-500 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRedeem(selectedReward)}
                          disabled={busy}
                          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#111827] text-white hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111827] disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Redeeming…</span></> : "Confirm"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
