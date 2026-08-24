"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { BarChart2, Gamepad2, Clock } from "lucide-react";
import { toast } from "sonner";
import { GAME_TYPE_LABELS, type GameTypeKey } from "@/lib/constants/gameTypes";
import { SoloGameGrid } from "@/components/minigames/solo/SoloGameGrid";
import { MultiplayerGamePicker } from "@/components/minigames/lobby/MultiplayerGamePicker";
import { ChallengeComposer } from "@/components/minigames/lobby/ChallengeComposer";
import { OpenChallengesPanel } from "@/components/minigames/lobby/OpenChallengesPanel";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle.
const HowToPlayModal = dynamic(
  () => import("@/components/minigames/HowToPlayModal").then((m) => m.HowToPlayModal),
  { ssr: false },
);

type Player = { id: string; displayName: string; avatarUrl: string | null };
type Session = {
  id: string;
  gameType: GameTypeKey;
  status: string;
  pointsWager: number;
  settings: Record<string, unknown>;
  host: Player;
  guest: Player | null;
  createdAt: string;
};

const GAME_LABEL = GAME_TYPE_LABELS;

export default function MinigamesPage() {
  const router = useRouter();
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const { fire } = useConfetti();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameTypeKey>("RPS");
  const [creating, setCreating] = useState(false);
  const [wager, setWager] = useState(0);
  const [chessTimeControl, setChessTimeControl] = useState<5 | 10>(5);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slow fallback poll. Realtime above is the primary path and already resyncs
  // on reconnect, so this only has to catch a broadcast that was dropped while
  // the socket stayed healthy — `broadcast()` no-ops on failure, so that is a
  // real but rare case. It does not need to be checked every minute: at 5
  // minutes it catches exactly the same failures for a fifth of the
  // invocations. Paused while the tab is hidden.
  useVisibleInterval(load, 300_000, true, { resumeHandledByRealtime: true });

  async function createChallenge() {
    setCreating(true);
    try {
      const settings = selectedGame === "CHESS" ? { timeControlMinutes: chessTimeControl } : {};
      const res = await apiFetch<{ data: Session }>("/api/minigames/sessions", {
        method: "POST",
        body: JSON.stringify({ gameType: selectedGame, pointsWager: wager, settings }),
      });
      fire();
      router.push(`/minigames/${res.data.id}`);
    } catch {
      toast.error("Failed to create challenge. Check your points balance.");
      setCreating(false);
    }
  }

  async function joinSession(sessionId: string) {
    setJoining(sessionId);
    try {
      await apiFetch(`/api/minigames/sessions/${sessionId}/join`, { method: "POST" });
      router.push(`/minigames/${sessionId}`);
    } catch {
      toast.error("Failed to join. Insufficient points or game already taken.");
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
      {showHelp && <HowToPlayModal gameType={selectedGame} onClose={() => setShowHelp(false)} />}

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

      <SoloGameGrid />

      <section aria-labelledby="multiplayer-heading" className="space-y-4">
        <div>
          <h2 id="multiplayer-heading" className="text-lg font-bold text-gray-900">Multiplayer</h2>
          <p className="mt-0.5 text-sm text-gray-500">Challenge a coworker to a quick 2-player game.</p>
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

      <MultiplayerGamePicker selected={selectedGame} onSelect={setSelectedGame} />

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <ChallengeComposer
            gameType={selectedGame}
            wager={wager}
            onWagerChange={setWager}
            chessTimeControl={chessTimeControl}
            onChessTimeControlChange={setChessTimeControl}
            creating={creating}
            onCreate={createChallenge}
            onShowHelp={() => setShowHelp(true)}
          />
        </div>

        <div className="w-full lg:w-96 shrink-0">
          <OpenChallengesPanel
            sessions={openChallenges}
            loading={loading}
            joining={joining}
            onJoin={joinSession}
          />
        </div>
      </div>
      </section>
    </div>
  );
}
