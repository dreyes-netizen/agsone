"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";

export function MinigamesStatsCard() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [s, setS] = useState<{ wins: number; losses: number; draws: number; winRate: number; currentStreak: number; total: number } | null>(null);

  useEffect(() => {
    apiFetch<{ data: typeof s }>("/api/minigames/stats").then((r) => setS(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s || s.total === 0) return null;

  return (
    <button
      onClick={() => router.push("/minigames/stats")}
      className="w-full text-left bg-white rounded-card border border-table-border px-5 py-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><span aria-hidden="true">🎮</span> Minigames</p>
        <span className="text-xs text-indigo-600 font-medium">View stats →</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm"><span className="font-bold text-emerald-600">{s.wins}</span> <span className="text-gray-500">W</span></span>
        <span className="text-sm"><span className="font-bold text-rose-500">{s.losses}</span> <span className="text-gray-500">L</span></span>
        <span className="text-sm"><span className="font-bold text-gray-500">{s.draws}</span> <span className="text-gray-500">D</span></span>
        <span className="text-sm"><span className="font-bold text-indigo-600">{s.winRate}%</span> <span className="text-gray-500">win rate</span></span>
        {s.currentStreak > 0 && (
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5"><span aria-hidden="true">🔥</span> {s.currentStreak}-win streak</span>
        )}
      </div>
    </button>
  );
}
