"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Flame } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

export function MinigamesStatsCard() {
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [s, setS] = useState<{ wins: number; losses: number; draws: number; winRate: number; currentStreak: number; total: number } | null>(null);

  function load() {
    apiFetch<{ data: typeof s }>("/api/minigames/stats")
      .then((r) => setS(r.data))
      .catch((err) => console.error("minigame stats fetch failed", err));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChannel(realtimeTopics.minigameStats, load, { debounceMs: 200 });

  if (!s || s.total === 0) return null;

  return (
    <button
      onClick={() => router.push("/minigames/stats")}
      className="w-full text-left bg-white rounded-card border border-table-border px-5 py-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Gamepad2 className="w-4 h-4" aria-hidden="true" /> Minigames</p>
        <span className="text-xs text-navy-600 font-medium">View stats →</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm"><span className="font-bold text-emerald-600">{s.wins}</span> <span className="text-gray-500">W</span></span>
        <span className="text-sm"><span className="font-bold text-rose-500">{s.losses}</span> <span className="text-gray-500">L</span></span>
        <span className="text-sm"><span className="font-bold text-gray-500">{s.draws}</span> <span className="text-gray-500">D</span></span>
        <span className="text-sm"><span className="font-bold text-navy-600">{s.winRate}%</span> <span className="text-gray-500">win rate</span></span>
        {s.currentStreak > 0 && (
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><Flame className="w-3 h-3" aria-hidden="true" /> {s.currentStreak}-win streak</span>
        )}
      </div>
    </button>
  );
}
