"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { ShoppingBag, CheckCircle, AlertCircle, Coins } from "lucide-react";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  stockQuantity: number;
  category: string;
};

const categoryConfig: Record<string, { emoji: string; label: string; accent: string; badge: string }> = {
  PHYSICAL:  { emoji: "📦", label: "Physical",  accent: "from-orange-400 to-amber-400",  badge: "bg-orange-50 text-orange-700 border-orange-200" },
  VOUCHER:   { emoji: "🎟️", label: "Voucher",   accent: "from-blue-500 to-cyan-400",     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  PRIVILEGE: { emoji: "⭐", label: "Privilege", accent: "from-violet-500 to-purple-500", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  DIGITAL:   { emoji: "💻", label: "Digital",   accent: "from-emerald-500 to-teal-400",  badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function MarketplacePage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Reward[] }>("/api/rewards").then((r) => setRewards(r.data)).catch(() => {});
    apiFetch<{ data: { pointsBalance: number } }>("/api/me").then((r) => setBalance(r.data.pointsBalance)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleRedeem(reward: Reward) {
    if (!confirm(`Redeem "${reward.name}" for ${reward.pointCost.toLocaleString()} points?`)) return;
    setRedeeming(reward.id);
    setToast(null);
    try {
      await apiFetch("/api/redemptions", { method: "POST", body: JSON.stringify({ rewardId: reward.id }) });
      setBalance((b) => b - reward.pointCost);
      setToast({ type: "success", msg: `"${reward.name}" redeemed! Pending HR approval.` });
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed to redeem" });
    } finally {
      setRedeeming(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const categories = ["ALL", "PHYSICAL", "VOUCHER", "PRIVILEGE", "DIGITAL"];
  const filtered = rewards.filter((r) => filter === "ALL" || r.category === filter);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Marketplace</h1>
          <p className="text-zinc-500 text-sm mt-1">Spend your points on something nice</p>
        </div>
        <div className="flex items-center gap-2 bg-navy-600 text-white px-3.5 py-2 rounded-lg shadow-sm">
          <Coins className="w-4 h-4 text-navy-200" />
          <span className="font-bold text-sm tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-navy-300 text-xs">pts</span>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${
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

      {/* ── Category filters ── */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => {
          const config = categoryConfig[cat];
          const active = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                active
                  ? "bg-navy-600 text-white border-navy-600"
                  : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {cat === "ALL" ? "All Rewards" : `${config.emoji} ${config.label}`}
            </button>
          );
        })}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-zinc-200">
          <ShoppingBag className="w-10 h-10 text-zinc-200 mb-4" />
          <p className="text-zinc-600 font-medium">No rewards here yet</p>
          <p className="text-zinc-400 text-sm mt-1">Ask HR to add items to the marketplace.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((reward) => {
            const cfg = categoryConfig[reward.category] ?? categoryConfig.PHYSICAL;
            const canAfford = balance >= reward.pointCost;
            const outOfStock = reward.stockQuantity === 0;
            const busy = redeeming === reward.id;

            return (
              <div
                key={reward.id}
                className={`bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow ${outOfStock ? "opacity-55" : ""}`}
              >
                {/* Color accent */}
                <div className={`h-1 bg-gradient-to-r ${cfg.accent}`} />

                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{cfg.emoji}</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-zinc-900">{reward.name}</h3>
                    {reward.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{reward.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100 mt-auto">
                    <div>
                      <p className={`font-bold text-lg leading-none tabular-nums ${canAfford && !outOfStock ? "text-navy-600" : "text-zinc-400"}`}>
                        {reward.pointCost.toLocaleString()}
                        <span className="text-sm font-medium ml-1">pts</span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {outOfStock ? "Out of stock" : reward.stockQuantity === -1 ? "Unlimited" : `${reward.stockQuantity} left`}
                      </p>
                    </div>
                    <button
                      disabled={!canAfford || outOfStock || busy}
                      onClick={() => handleRedeem(reward)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        outOfStock || !canAfford
                          ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                          : "bg-navy-600 text-white hover:bg-navy-700"
                      }`}
                    >
                      {busy ? "…" : outOfStock ? "Sold Out" : !canAfford ? "Can't Afford" : "Redeem"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
