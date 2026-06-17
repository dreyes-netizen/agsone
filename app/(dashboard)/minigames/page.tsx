"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { HowToPlayModal } from "@/components/minigames/HowToPlayModal";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { BarChart2, Gamepad2, Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react";

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
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

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
      showToast("error", "Failed to create challenge. Check your points balance.");
      setCreating(false);
    }
  }

  async function joinSession(sessionId: string) {
    setJoining(sessionId);
    try {
      await apiFetch(`/api/minigames/sessions/${sessionId}/join`, { method: "POST" });
      router.push(`/minigames/${sessionId}`);
    } catch {
      showToast("error", "Failed to join. Insufficient points or game already taken.");
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

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto sm:max-w-sm z-[60] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:fade-in-0 motion-safe:duration-300 ${
            toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minigames</h1>
          <p className="text-sm text-gray-500 mt-0.5">Challenge a coworker to a quick 2-player game.</p>
        </div>
        <button
          aria-label="Stats and Leaderboard"
          onClick={() => router.push("/minigames/stats")}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          <BarChart2 className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Stats & Leaderboard</span><span className="sm:hidden">Stats</span>
        </button>
      </div>

      {/* Active + waiting banners */}
      {(myActive.length > 0 || myWaiting.length > 0) && (
        <div className="space-y-2">
          {myActive.map(s => (
            <button
              key={s.id}
              onClick={() => router.push(`/minigames/${s.id}`)}
              aria-label={`Resume ${GAME_LABEL[s.gameType]} — active game`}
              className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 hover:bg-emerald-100/60 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
            >
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
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
                <Clock className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">{GAME_LABEL[s.gameType]} — Waiting for opponent</p>
                  {s.pointsWager > 0 && <p className="text-xs text-amber-600">{s.pointsWager} pts wager</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/minigames/${s.id}`)}
                  aria-label={`Invite someone to ${GAME_LABEL[s.gameType]}`}
                  className="text-xs bg-white border border-amber-300 text-amber-700 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-amber-600"
                >
                  Invite →
                </button>
                <button
                  onClick={() => cancelSession(s.id)}
                  disabled={cancelling === s.id}
                  aria-label={`Cancel ${GAME_LABEL[s.gameType]} challenge`}
                  className="text-xs text-red-400 hover:text-red-600 font-medium px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500 rounded"
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
            <div role="tablist" aria-label="Game type" className="flex border-b border-gray-100 overflow-x-auto">
              {GAME_TYPES.map(g => (
                <button
                  key={g.key}
                  role="tab"
                  aria-selected={activeTab === g.key}
                  aria-label={g.label.replace(/^[^\w]*/, "").trim()}
                  onClick={() => setActiveTab(g.key)}
                  className={`flex-1 min-w-[52px] sm:min-w-[80px] px-1 sm:px-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${
                    activeTab === g.key
                      ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/60"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
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
              <p className="text-xs font-medium text-gray-500 mb-2" id="wager-label">Points wager</p>
              <div className="flex gap-2" role="group" aria-labelledby="wager-label">
                {WAGER_OPTIONS.map(w => (
                  <button
                    key={w}
                    aria-pressed={wager === w}
                    onClick={() => setWager(w)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 ${
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
              className="w-full py-2.5 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
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
                <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
                </div>
              ) : openChallenges.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Gamepad2 className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-gray-600 font-medium">No open challenges yet</p>
                  <p className="text-xs text-gray-500 mt-1">Create one and invite a coworker!</p>
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
                      className="shrink-0 px-4 py-2 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors min-w-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
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
