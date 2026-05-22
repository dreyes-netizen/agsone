"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

type Game = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  entryCostPoints: number;
  dailyPlaysLimit: number;
  playsToday: number;
  canPlay: boolean;
  endDate: string | null;
};

const gameConfig: Record<string, {
  emoji: string;
  label: string;
  gradient: string;
  badge: string;
  iconBg: string;
}> = {
  SPIN_WHEEL: {
    emoji: "🎡",
    label: "Spin the Wheel",
    gradient: "from-violet-500 to-navy-500",
    badge: "bg-violet-50 text-violet-700 border border-violet-200",
    iconBg: "bg-violet-50",
  },
  RAFFLE: {
    emoji: "🎟️",
    label: "Lucky Draw",
    gradient: "from-amber-400 to-orange-500",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    iconBg: "bg-amber-50",
  },
  MYSTERY_BOX: {
    emoji: "📦",
    label: "Mystery Box",
    gradient: "from-pink-500 to-rose-500",
    badge: "bg-pink-50 text-pink-700 border border-pink-200",
    iconBg: "bg-pink-50",
  },
  QUIZ: {
    emoji: "🧠",
    label: "Quiz",
    gradient: "from-cyan-500 to-blue-500",
    badge: "bg-cyan-50 text-cyan-700 border border-cyan-200",
    iconBg: "bg-cyan-50",
  },
  PREDICTION: {
    emoji: "🔮",
    label: "Prediction",
    gradient: "from-emerald-500 to-teal-500",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    iconBg: "bg-emerald-50",
  },
};

const fallbackConfig = {
  emoji: "🎮",
  label: "Game",
  gradient: "from-navy-500 to-violet-500",
  badge: "bg-navy-50 text-navy-700 border border-navy-200",
  iconBg: "bg-navy-50",
};

export default function GamesPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Game[] }>("/api/games").then((res) => {
      setGames(res.data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Game Arcade</h1>
        <p className="text-zinc-500 text-sm mt-1">Spend your points, beat the odds, win big.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 overflow-hidden animate-pulse">
              <div className="h-1 bg-zinc-100" />
              <div className="p-5 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-100" />
                <div className="h-4 bg-zinc-100 rounded w-3/4" />
                <div className="h-3 bg-zinc-100 rounded w-full" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
                <div className="h-9 bg-zinc-100 rounded-lg w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-zinc-200 bg-white text-center">
          <span className="text-5xl mb-4">🎮</span>
          <p className="text-zinc-900 font-semibold text-lg">No games available</p>
          <p className="text-zinc-400 text-sm mt-1">Check back soon — HR will drop new games!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => {
            const cfg = gameConfig[game.type] ?? fallbackConfig;
            const playsLeft = game.dailyPlaysLimit - game.playsToday;

            return (
              <div
                key={game.id}
                className={`bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col transition-shadow ${
                  game.canPlay ? "hover:shadow-md" : "opacity-60"
                }`}
              >
                {/* Color accent strip */}
                <div className={`h-1 bg-gradient-to-r ${cfg.gradient}`} />

                <div className="p-5 flex flex-col flex-1">
                  {/* Icon + type badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${cfg.iconBg} flex items-center justify-center text-2xl`}>
                      {cfg.emoji}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Name + description */}
                  <h2 className="font-bold text-zinc-900 leading-snug">{game.name}</h2>
                  {game.description && (
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{game.description}</p>
                  )}

                  {/* Metadata chips */}
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <span className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 rounded-full font-medium">
                      {game.entryCostPoints > 0 ? `${game.entryCostPoints} pts/play` : "Free to play"}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                      playsLeft > 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-zinc-50 text-zinc-400 border-zinc-200"
                    }`}>
                      {playsLeft > 0 ? `${playsLeft} play${playsLeft === 1 ? "" : "s"} left` : "No plays left"}
                    </span>
                    {game.endDate && (
                      <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 rounded-full font-medium">
                        Ends {new Date(game.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="mt-auto pt-4">
                    {game.canPlay ? (
                      <button
                        onClick={() => router.push(`/games/${game.id}`)}
                        className="w-full bg-navy-600 hover:bg-navy-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
                      >
                        Play Now
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-400 font-semibold text-sm py-2.5 rounded-lg cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Come back tomorrow
                      </button>
                    )}
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
