"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Trophy, Flame, Medal, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/helpers/timeAgo";

const GAME_LABEL: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe", CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors", DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship", MEMORY: "Memory",
};

const GAME_EMOJI: Record<string, string> = {
  TIC_TAC_TOE: "⭕", CONNECT_FOUR: "🔴", RPS: "✌️",
  DOTS_AND_BOXES: "🟦", BATTLESHIP: "🚢", MEMORY: "🧠",
};

type HistoryItem = {
  id: string;
  gameType: string;
  outcome: "win" | "loss" | "draw";
  wager: number;
  opponentName: string;
  opponentAvatarUrl: string | null;
  finishedAt: string;
};

type Stats = {
  wins: number; losses: number; draws: number; total: number;
  winRate: number; currentStreak: number;
  perGame: Record<string, { w: number; l: number; d: number }>;
  history: HistoryItem[];
};

type LeaderEntry = {
  rank: number; userId: string; displayName: string; avatarUrl: string | null;
  department: string | null; wins: number; losses: number; draws: number;
  total: number; winRate: number; isCurrentUser: boolean;
};

const rankColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-zinc-500", 3: "text-orange-500" };

function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${cls} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const outcomeStyle: Record<string, { label: string; cls: string }> = {
  win:  { label: "Won",  cls: "text-emerald-600 bg-emerald-50" },
  loss: { label: "Lost", cls: "text-rose-500 bg-rose-50" },
  draw: { label: "Draw", cls: "text-zinc-500 bg-zinc-100" },
};

export default function MinigamesStatsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<LeaderEntry[]>([]);
  const [period, setPeriod] = useState<"monthly" | "alltime">("alltime");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Stats }>("/api/minigames/stats").then(res => setStats(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    apiFetch<{ data: LeaderEntry[] }>(`/api/minigames/leaderboard?period=${period}`)
      .then(res => setBoard(res.data))
      .catch(() => setBoard([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, period]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/minigames")} className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded">
          ← Minigames
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 flex-1">Stats & Leaderboard</h1>
      </div>

      {/* Personal summary */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">{stats?.wins ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Wins</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-rose-500">{stats?.losses ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Losses</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-500">{stats?.draws ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Draws</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">{stats?.winRate ?? 0}%</p>
            <p className="text-xs text-zinc-500 mt-0.5">Win rate</p>
          </div>
        </div>
        {(stats?.currentStreak ?? 0) > 0 && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 rounded-xl py-2">
            <Flame className="w-4 h-4" /> {stats!.currentStreak}-win streak
          </div>
        )}
      </div>

      {/* Per-game breakdown */}
      {stats && Object.keys(stats.perGame).length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-zinc-800 mb-3">By game</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.perGame).map(([g, r]) => (
              <div key={g} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-50 border border-zinc-200 text-xs">
                <span>{GAME_EMOJI[g] ?? "🎮"}</span>
                <span className="font-medium text-zinc-700">{GAME_LABEL[g] ?? g}</span>
                <span className="text-zinc-500">{r.w}W·{r.l}L{r.d > 0 ? `·${r.d}D` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <p className="text-sm font-bold text-zinc-800 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-yellow-500" /> Leaderboard</p>
          <div role="group" aria-label="Leaderboard period" className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs">
            <button aria-pressed={period === "monthly"} className={`px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${period === "monthly" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"}`} onClick={() => setPeriod("monthly")}>This Month</button>
            <button aria-pressed={period === "alltime"} className={`px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${period === "alltime" ? "bg-[#111827] text-white" : "text-zinc-600 hover:bg-zinc-50"}`} onClick={() => setPeriod("alltime")}>All Time</button>
          </div>
        </div>
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : board.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-sm">No games played yet. Be the first!</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {board.map(e => (
              <li key={e.userId} className={`flex items-center gap-3 px-5 py-3 ${e.isCurrentUser ? "bg-indigo-50 border-l-2 border-indigo-500" : "border-l-2 border-transparent"}`}>
                <span className={`w-7 text-center font-bold text-sm tabular-nums ${rankColors[e.rank] ?? "text-zinc-500"}`}>
                  {e.rank <= 3 ? <Medal className={`w-4 h-4 inline ${rankColors[e.rank]}`} /> : `#${e.rank}`}
                </span>
                <Avatar name={e.displayName} url={e.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-zinc-900 truncate">{e.isCurrentUser ? `${e.displayName} (You)` : e.displayName}</p>
                  <p className="text-xs text-zinc-500">{e.wins}W · {e.losses}L{e.draws > 0 ? ` · ${e.draws}D` : ""}</p>
                </div>
                <span className="font-bold text-indigo-600 text-sm tabular-nums">{e.winRate}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent history */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <p className="text-sm font-bold text-zinc-800">Recent games</p>
        </div>
        {!stats || stats.history.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-sm">No finished games yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {stats.history.map(h => {
              const o = outcomeStyle[h.outcome];
              return (
                <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-lg shrink-0">{GAME_EMOJI[h.gameType] ?? "🎮"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{GAME_LABEL[h.gameType] ?? h.gameType}</p>
                    <p className="text-xs text-zinc-500 truncate">vs {h.opponentName} · {timeAgo(h.finishedAt)}</p>
                  </div>
                  {h.wager > 0 && <span className="text-xs text-amber-600 font-medium shrink-0">{h.wager} pts</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${o.cls}`}>{o.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
