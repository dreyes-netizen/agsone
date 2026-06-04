"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { HowToPlayModal } from "@/components/minigames/HowToPlayModal";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";

const GAME_TYPES = [
  { key: "RPS",             label: "✌️ Rock Paper Scissors", short: "✌️ RPS",    desc: "3 rounds · Simultaneous picks · Quick & fun" },
  { key: "TIC_TAC_TOE",    label: "⭕ Tic-Tac-Toe",          short: "⭕ TTT",    desc: "3×3 grid · Get 3 in a row to win" },
  { key: "CONNECT_FOUR",   label: "🔴 Connect Four",          short: "🔴 C4",     desc: "7×6 grid · First to 4-in-a-row wins" },
  { key: "DOTS_AND_BOXES", label: "🟦 Dots & Boxes",          short: "🟦 D&B",    desc: "4×4 grid · Claim the most boxes" },
  { key: "BATTLESHIP",     label: "🚢 Battleship",            short: "🚢 BS",     desc: "8×8 grid · Sink all enemy ships to win" },
  { key: "MEMORY",         label: "🧠 Memory",                short: "🧠 Mem",    desc: "4×4 grid · Match all emoji pairs to win" },
] as const;
type GameTypeKey = typeof GAME_TYPES[number]["key"];

const WAGER_OPTIONS = [0, 10, 25, 50];

type Player = { id: string; displayName: string; avatarUrl: string | null };
type Session = {
  id: string;
  gameType: GameTypeKey;
  status: string;
  pointsWager: number;
  host: Player;
  guest: Player | null;
  createdAt: string;
};

const GAME_LABEL: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe", CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors", DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship", MEMORY: "Memory",
};

export default function MinigamesPage() {
  const router = useRouter();
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const { fire } = useConfetti();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GameTypeKey>("RPS");
  const [creating, setCreating] = useState(false);
  const [wager, setWager] = useState(0);
  const [joining, setJoining] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<{ data: Session[] }>("/api/minigames/sessions");
      setSessions(res.data);
    } finally {
      setLoading(false);
    }
  }

  // Real-time: refresh the moment a challenge is created/joined/cancelled.
  useRealtimeChannel("lobby", load);

  useEffect(() => {
    load();
    // Slow fallback poll — Realtime handles the common case; this only catches
    // a rare dropped message.
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createChallenge() {
    setCreating(true);
    try {
      const res = await apiFetch<{ data: Session }>("/api/minigames/sessions", {
        method: "POST",
        body: JSON.stringify({ gameType: activeTab, pointsWager: wager }),
      });
      fire();
      router.push(`/minigames/${res.data.id}`);
    } catch {
      alert("Failed to create challenge. Check your points balance.");
      setCreating(false);
    }
  }

  async function joinSession(sessionId: string) {
    setJoining(sessionId);
    try {
      await apiFetch(`/api/minigames/sessions/${sessionId}/join`, { method: "POST" });
      router.push(`/minigames/${sessionId}`);
    } catch {
      alert("Failed to join. Insufficient points or game already taken.");
      setJoining(null);
      load();
    }
  }

  async function cancelSession(sessionId: string) {
    setCancelling(sessionId);
    try {
      await apiFetch(`/api/minigames/sessions/${sessionId}/forfeit`, { method: "POST" });
      setSessions(s => s.filter(x => x.id !== sessionId));
    } finally {
      setCancelling(null);
    }
  }

  // Show every open challenge regardless of which game tab is selected — a
  // waiting RPS game should still be discoverable while browsing Connect Four.
  const openChallenges = sessions.filter(s =>
    s.status === "WAITING" && s.host.id !== dbUser?.id
  );
  const myWaiting = sessions.filter(s => s.status === "WAITING" && s.host.id === dbUser?.id);
  const myActive = sessions.filter(s =>
    s.status === "ACTIVE" && (s.host.id === dbUser?.id || s.guest?.id === dbUser?.id)
  );

  return (
    <div className="space-y-4">
      {showHelp && <HowToPlayModal gameType={activeTab} onClose={() => setShowHelp(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minigames</h1>
          <p className="text-sm text-gray-500 mt-0.5">Challenge a coworker to a quick 2-player game.</p>
        </div>
        <button
          onClick={() => router.push("/minigames/stats")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          📊 <span className="hidden sm:inline">Stats & Leaderboard</span><span className="sm:hidden">Stats</span>
        </button>
      </div>

      {/* Active + waiting banners */}
      {(myActive.length > 0 || myWaiting.length > 0) && (
        <div className="space-y-2">
          {myActive.map(s => (
            <button
              key={s.id}
              onClick={() => router.push(`/minigames/${s.id}`)}
              className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 hover:bg-emerald-100/60 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🎮</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{GAME_LABEL[s.gameType]} — Active</p>
                  <p className="text-xs text-emerald-700">vs {s.host.id === dbUser?.id ? s.guest?.displayName : s.host.displayName}</p>
                </div>
              </div>
              <span className="text-xs bg-emerald-200 text-emerald-800 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">Resume →</span>
            </button>
          ))}
          {myWaiting.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">⏳</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">{GAME_LABEL[s.gameType]} — Waiting for opponent</p>
                  {s.pointsWager > 0 && <p className="text-xs text-amber-600">{s.pointsWager} pts wager</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push(`/minigames/${s.id}`)} className="text-xs bg-white border border-amber-300 text-amber-700 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                  Invite →
                </button>
                <button
                  onClick={() => cancelSession(s.id)}
                  disabled={cancelling === s.id}
                  className="text-xs text-red-400 hover:text-red-600 font-medium px-2"
                >
                  {cancelling === s.id ? "…" : "Cancel"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Left: game type selector + create */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Game type tabs */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {GAME_TYPES.map(g => (
                <button
                  key={g.key}
                  onClick={() => setActiveTab(g.key)}
                  className={`flex-1 min-w-[52px] sm:min-w-[80px] px-1 sm:px-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === g.key
                      ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/60"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <span className="hidden sm:inline">{g.label}</span>
                  <span className="sm:hidden">{g.short}</span>
                </button>
              ))}
            </div>
            <div className="p-1">
              {GAME_TYPES.map(g => (
                g.key === activeTab && (
                  <div
                    key={g.key}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-50 border border-indigo-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-indigo-900">{g.label}</p>
                      <p className="text-xs text-indigo-600 mt-0.5">{g.desc}</p>
                    </div>
                    <button
                      onClick={() => setShowHelp(true)}
                      className="shrink-0 text-xs text-indigo-500 hover:text-indigo-700 font-semibold underline underline-offset-2 whitespace-nowrap"
                    >
                      How to play
                    </button>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Create challenge */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-800">Create a Challenge</p>
              <p className="text-xs text-gray-500 mt-0.5">Post an open challenge — anyone can join from the lobby. Or invite someone directly from the game room.</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Points wager</p>
              <div className="flex gap-2">
                {WAGER_OPTIONS.map(w => (
                  <button
                    key={w}
                    onClick={() => setWager(w)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      wager === w
                        ? "bg-[#111827] border-[#111827] text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {w === 0 ? "Free" : `${w} pts`}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={createChallenge}
              disabled={creating}
              className="w-full py-2.5 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {creating ? "Creating…" : `Create ${GAME_LABEL[activeTab]} Challenge`}
            </button>
          </div>
        </div>

        {/* Right: open challenges */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">Open Challenges</p>
              <span className="text-xs text-gray-400">{openChallenges.length > 0 ? `${openChallenges.length} open · all games` : "all games"}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
              ) : openChallenges.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-2xl mb-2">🕹️</p>
                  <p className="text-sm text-gray-500 font-medium">No open challenges yet</p>
                  <p className="text-xs text-gray-400 mt-1">Create one and invite a coworker!</p>
                </div>
              ) : (
                openChallenges.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    {s.host.avatarUrl ? (
                      <img src={s.host.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                        {s.host.displayName[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.host.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        <span className="font-medium text-gray-700">{GAME_LABEL[s.gameType]}</span>
                        {s.pointsWager > 0 ? (
                          <span className="text-amber-600 font-medium"> · {s.pointsWager} pts</span>
                        ) : (
                          <span className="text-gray-400"> · Friendly</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => joinSession(s.id)}
                      disabled={joining === s.id}
                      className="shrink-0 px-4 py-2 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors min-w-[60px]"
                    >
                      {joining === s.id ? "…" : "Join"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
