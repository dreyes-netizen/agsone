"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { sounds } from "@/lib/minigames/sounds";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { ForfeitModal } from "@/components/minigames/ForfeitModal";
import { MobileBar } from "@/components/minigames/MobileBar";
import { RightPanel } from "@/components/minigames/RightPanel";
import { TTTBoard } from "@/components/minigames/boards/TTTBoard";
import { C4Board } from "@/components/minigames/boards/C4Board";
import { RPSBoard } from "@/components/minigames/boards/RPSBoard";
import { DnBBoard } from "@/components/minigames/boards/DnBBoard";
import { BSBoard } from "@/components/minigames/boards/BSBoard";
import { MemoryBoard } from "@/components/minigames/boards/MemoryBoard";
import type { Session } from "@/components/minigames/types";

// Both closed/hidden by default — split into their own chunks instead of
// shipping with the page bundle.
const HowToPlayModal = dynamic(
  () => import("@/components/minigames/HowToPlayModal").then((m) => m.HowToPlayModal),
  { ssr: false },
);
const GameResultOverlay = dynamic(
  () => import("@/components/minigames/GameResultOverlay").then((m) => m.GameResultOverlay),
  { ssr: false },
);

const GAME_LABELS: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors",
  DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship",
  MEMORY: "Memory",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MinigameSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const { fire } = useConfetti();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [moveToast, setMoveToast] = useState<string | null>(null);

  function showMoveError(msg: string) {
    setMoveToast(msg);
    setTimeout(() => setMoveToast(null), 4000);
  }
  const [h2h, setH2h] = useState<{ wins: number; losses: number; draws: number } | null>(null);
  const prevStatus = useRef<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Session }>(`/api/minigames/sessions/${id}`);
      setSession(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { queueMicrotask(fetchSession); }, [fetchSession]);

  // Real-time: re-fetch the instant the opponent moves/joins/forfeits. Like
  // every other channel, suspended after the tab has been hidden a while and
  // resynced on return — see lib/hooks/useRealtimeChannel.ts. A player who's
  // been tabbed out for 2+ minutes isn't actively playing, so the game
  // channel isn't exempted via keepAliveWhenHidden.
  useRealtimeChannel(session ? `game:${id}` : null, fetchSession);

  // Slow fallback poll — only catches the rare dropped Realtime message.
  // Stops once the game is over, and paused while the tab is hidden.
  const gameInProgress = !!session && session.status !== "FINISHED" && session.status !== "CANCELLED";
  // Moves arrive through Realtime. Keep a slower visible-tab fallback so a
  // dropped broadcast self-heals without invoking Vercel every ten seconds.
  useVisibleInterval(fetchSession, 30_000, gameInProgress);

  useEffect(() => {
    if (!session || !dbUser) return;
    const justFinished = prevStatus.current !== "FINISHED" && session.status === "FINISHED";
    if (justFinished) {
      if (session.winnerId === dbUser.id) { fire(); sounds.win(); }
      else sounds.lose();
    }
    prevStatus.current = session.status;
  }, [session?.status, session?.winnerId, dbUser?.id]);

  useEffect(() => {
    if (!session || session.status !== "FINISHED") return;
    const opponent = session.myRole === "host" ? session.guest : session.host;
    if (!opponent) return;
    apiFetch<{ data: { wins: number; losses: number; draws: number } }>(
      `/api/minigames/stats?opponentId=${opponent.id}`
    )
      .then(r => setH2h(r.data))
      .catch((err) => console.error("head-to-head stats fetch failed", err));
  }, [session?.status, session?.guest?.id, session?.host?.id]);

  async function makeMove(data: unknown) {
    if (moving || !session) return;
    setMoving(true);
    try {
      const res = await apiFetch<{ data: Session }>(`/api/minigames/sessions/${id}/move`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSession(res.data);
      sounds.move();
    } catch (e: unknown) {
      const msg = (e as Error).message || "Invalid move";
      if (!msg.includes("Not your turn")) showMoveError(msg);
    } finally {
      setMoving(false);
    }
  }

  async function forfeit() {
    if (!session || forfeiting) return;
    setShowForfeitModal(true);
  }

  async function executeForfeit() {
    if (!session) return;
    setShowForfeitModal(false);
    setForfeiting(true);
    try {
      await apiFetch(`/api/minigames/sessions/${id}/forfeit`, { method: "POST" });
      await fetchSession();
    } finally {
      setForfeiting(false);
    }
  }

  if (loading) return (
    <div role="status" aria-label="Loading game" className="max-w-3xl mx-auto flex items-center justify-center gap-2 min-h-[300px] text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      <p className="text-sm">Loading game…</p>
    </div>
  );

  if (!session) return (
    <div className="max-w-3xl mx-auto text-center py-20">
      <p className="text-gray-500">Game not found.</p>
      <button onClick={() => router.push("/minigames")} className="mt-4 text-navy-600 text-sm">← Back to lobby</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {showHelp && <HowToPlayModal gameType={session.gameType} onClose={() => setShowHelp(false)} />}

      <ForfeitModal
        open={showForfeitModal}
        opponentName={
          (session.myRole === "host" ? session.guest?.displayName : session.host.displayName) ?? "Your opponent"
        }
        confirming={forfeiting}
        onConfirm={executeForfeit}
        onCancel={() => setShowForfeitModal(false)}
      />

      {session.status === "FINISHED" && session.myRole !== "spectator" && (
        <GameResultOverlay
          session={session}
          myId={dbUser?.id}
          h2h={h2h}
          onNavigate={router.push}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/minigames")}
          aria-label="Back to lobby"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded px-1 py-0.5"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Lobby
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{GAME_LABELS[session.gameType] ?? session.gameType}</h1>
        <button
          onClick={() => setShowHelp(true)}
          aria-label="How to play"
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-navy-600 hover:border-navy-300 hover:bg-navy-50 transition-colors text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-500"
        >
          <span aria-hidden="true">?</span>
        </button>
      </div>

      {/* Move error toast */}
      {moveToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200 shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:fade-in-0 motion-safe:duration-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" aria-hidden="true" />
          {moveToast}
        </div>
      )}

      {/* Mobile: compact status bar (players, status, wager, actions) */}
      <div className="lg:hidden">
        <MobileBar
          session={session}
          myId={dbUser?.id}
          forfeiting={forfeiting}
          onForfeit={forfeit}
          router={router}
          apiFetch={apiFetch}
        />
      </div>

      {/* Board + desktop sidebar */}
      <div className="flex flex-col lg:flex-row gap-5 lg:items-start">

        {/* Game board */}
        <div className={`w-full lg:flex-1 min-w-0 bg-white border border-table-border rounded-card p-2 lg:p-6 transition-opacity ${moving ? "opacity-70 pointer-events-none" : ""}`}>
          {session.status === "WAITING" && session.gameType !== "BATTLESHIP" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-5xl mb-4">⏳</span>
              <p className="text-gray-700 font-semibold">Waiting for someone to join</p>
              <p className="text-sm text-gray-500 mt-1">Use the invite button to challenge a coworker directly.</p>
            </div>
          ) : (
            <>
              {session.gameType === "TIC_TAC_TOE"    && <TTTBoard    session={session} onMove={makeMove} />}
              {session.gameType === "CONNECT_FOUR"   && <C4Board     session={session} onMove={makeMove} />}
              {session.gameType === "RPS"            && <RPSBoard    session={session} onMove={makeMove} />}
              {session.gameType === "DOTS_AND_BOXES" && <DnBBoard    session={session} onMove={makeMove} />}
              {session.gameType === "BATTLESHIP"     && <BSBoard     session={session} onMove={makeMove} />}
              {session.gameType === "MEMORY"         && <MemoryBoard session={session} onMove={makeMove} />}
            </>
          )}
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block lg:w-72 shrink-0">
          <RightPanel
            session={session}
            onForfeit={forfeit}
            forfeiting={forfeiting}
            router={router}
            apiFetch={apiFetch}
          />
        </div>
      </div>
    </div>
  );
}
