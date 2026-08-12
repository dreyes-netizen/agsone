"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Trophy, Flame, Medal, Loader2, Gamepad2 } from "lucide-react";
import { timeAgo } from "@/lib/helpers/timeAgo";
import { GAME_TYPE_LABELS, GAME_TYPE_ICONS } from "@/lib/constants/gameTypes";

const GAME_LABEL = GAME_TYPE_LABELS;

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

const rankColors: Record<number, string> = { 1: "text-amber-500", 2: "text-gray-500", 3: "text-amber-700" };

function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const [errored, setErrored] = useState(false);
  const cls = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (url && !errored) return <img src={url} alt={name} className={`${cls} rounded-full object-cover shrink-0`} onError={() => setErrored(true)} />;
  return (
    <div className={`${cls} rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const outcomeStyle: Record<string, { label: string; cls: string }> = {
  win:  { label: "Won",  cls: "text-emerald-600 bg-emerald-50" },
  loss: { label: "Lost", cls: "text-rose-500 bg-rose-50" },
  draw: { label: "Draw", cls: "text-gray-500 bg-gray-100" },
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
    apiFetch<{ data: Stats }>("/api/minigames/stats").then(res => setStats(res.data)).catch((err) => console.error("minigame stats fetch failed", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(() => setLoading(true));
    apiFetch<{ data: LeaderEntry[] }>(`/api/minigames/leaderboard?period=${period}`)
      .then(res => setBoard(res.data))
      .catch(() => setBoard([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, period]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/minigames")} aria-label="Back to minigames" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded">
          ← Minigames
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">Stats & Leaderboard</h1>
      </div>

      {/* Personal summary */}
      <div className="bg-white border border-table-border rounded-card p-5">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">{stats?.wins ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Wins</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-rose-500">{stats?.losses ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Losses</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-500">{stats?.draws ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Draws</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-navy-600">{stats?.winRate ?? 0}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Win rate</p>
          </div>
        </div>
        {(stats?.currentStreak ?? 0) > 0 && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-50 rounded-xl py-2">
            <Flame className="w-4 h-4" aria-hidden="true" /> {stats!.currentStreak}-win streak
          </div>
        )}
      </div>

      {/* Per-game breakdown */}
      {stats && Object.keys(stats.perGame).length > 0 && (
        <div className="bg-white border border-table-border rounded-card p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">By game</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.perGame).map(([g, r]) => {
              const Icon = GAME_TYPE_ICONS[g] ?? Gamepad2;
              return (
                <div key={g} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs">
                  <Icon className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                  <span className="font-medium text-gray-700">{GAME_LABEL[g] ?? g}</span>
                  <span className="text-gray-500">{r.w}W·{r.l}L{r.d > 0 ? `·${r.d}D` : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Leaderboard</p>
          <div role="group" aria-label="Leaderboard period" className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button aria-pressed={period === "monthly"} className={`px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${period === "monthly" ? "bg-command-black text-white" : "text-gray-600 hover:bg-gray-50"}`} onClick={() => setPeriod("monthly")}>This Month</button>
            <button aria-pressed={period === "alltime"} className={`px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900 ${period === "alltime" ? "bg-command-black text-white" : "text-gray-600 hover:bg-gray-50"}`} onClick={() => setPeriod("alltime")}>All Time</button>
          </div>
        </div>
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : board.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">No games played yet. Be the first!</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {board.map(e => (
              <li key={e.userId} aria-label={`Rank ${e.rank}: ${e.displayName}, ${e.wins} wins, ${e.winRate}% win rate`} className={`flex items-center gap-3 px-5 py-3 ${e.isCurrentUser ? "bg-navy-50 border-l-2 border-navy-500" : "border-l-2 border-transparent"}`}>
                <span className={`w-7 text-center font-bold text-sm tabular-nums ${rankColors[e.rank] ?? "text-gray-500"}`}>
                  {e.rank <= 3 ? <Medal className={`w-4 h-4 inline ${rankColors[e.rank]}`} /> : `#${e.rank}`}
                </span>
                <Avatar name={e.displayName} url={e.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{e.isCurrentUser ? `${e.displayName} (You)` : e.displayName}</p>
                  <p className="text-xs text-gray-500">{e.wins}W · {e.losses}L{e.draws > 0 ? ` · ${e.draws}D` : ""}</p>
                </div>
                <span className="font-bold text-navy-600 text-sm tabular-nums">{e.winRate}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent history */}
      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">Recent games</p>
        </div>
        {!stats || stats.history.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">No finished games yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {stats.history.map(h => {
              const o = outcomeStyle[h.outcome];
              const Icon = GAME_TYPE_ICONS[h.gameType] ?? Gamepad2;
              return (
                <li key={h.id} aria-label={`${GAME_LABEL[h.gameType] ?? h.gameType} vs ${h.opponentName}, ${o.label}${h.wager > 0 ? `, ${h.wager} pts wager` : ""}, ${timeAgo(h.finishedAt)}`} className="flex items-center gap-3 px-5 py-3">
                  <Icon className="w-5 h-5 shrink-0 text-gray-500" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{GAME_LABEL[h.gameType] ?? h.gameType}</p>
                    <p className="text-xs text-gray-500 truncate">vs {h.opponentName} · {timeAgo(h.finishedAt)}</p>
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
