"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

type Player = { id: string; displayName: string; avatarUrl: string | null };

type Session = {
  id: string;
  gameType: string;
  status: string;
  state: Record<string, unknown>;
  winnerId: string | null;
  pointsWager: number;
  host: Player;
  guest: Player | null;
  myRole: "host" | "guest" | "spectator";
};

const GAME_LABELS: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors",
  DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship",
  MEMORY: "Memory",
};

type Props = {
  session: Session;
  myId: string | undefined;
  h2h: { wins: number; losses: number; draws: number } | null;
  onNavigate: (path: string) => void;
};

export function GameResultOverlay({ session, myId, h2h, onNavigate }: Props) {
  const { apiFetch } = useApiClient();
  const [visible, setVisible] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fade in after a short delay so confetti fires first
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  const won = !!myId && session.winnerId === myId;
  const draw = !session.winnerId;
  const opponent = session.myRole === "host" ? session.guest : session.host;

  const rematchId = (session.state as { rematchSessionId?: string }).rematchSessionId;
  const rematchHostId = (session.state as { rematchHostId?: string }).rematchHostId;
  const iStartedRematch = !!rematchHostId && rematchHostId === myId;

  const emoji = draw ? "🤝" : won ? "🏆" : "💪";
  const title = draw ? "It's a Draw!" : won ? "Victory!" : "Good Game";

  const pointsLabel = session.pointsWager > 0
    ? (draw ? "±0 pts" : won ? `+${session.pointsWager} pts` : `−${session.pointsWager} pts`)
    : null;
  const pointsColor = draw ? "text-amber-300" : won ? "text-indigo-300" : "text-rose-300";

  const bgGradient = draw
    ? "from-[#451a03] to-[#78350f]"
    : won
    ? "from-[#1e1b4b] to-[#312e81]"
    : "from-[#1c1917] to-[#292524]";

  let h2hLine: string | null = null;
  if (h2h && opponent && h2h.wins + h2h.losses + h2h.draws > 0) {
    const record = `${h2h.wins}–${h2h.losses}${h2h.draws > 0 ? `–${h2h.draws}` : ""}`;
    const verdict =
      h2h.wins > h2h.losses ? "you lead" :
      h2h.wins < h2h.losses ? "you trail" : "all square";
    h2hLine = `vs ${opponent.displayName} · ${record} · ${verdict}`;
  }

  async function startRematch() {
    setRematching(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>(
        `/api/minigames/sessions/${session.id}/rematch`,
        { method: "POST" }
      );
      onNavigate(`/minigames/${res.data.id}`);
    } catch {
      setRematching(false);
      setError("Couldn't start a rematch — please try again.");
      setTimeout(() => setError(null), 4000);
    }
  }

  async function acceptRematch() {
    if (!rematchId) return;
    setRematching(true);
    try {
      await apiFetch(`/api/minigames/sessions/${rematchId}/join`, { method: "POST" });
      onNavigate(`/minigames/${rematchId}`);
    } catch {
      setRematching(false);
      setError("Couldn't join the rematch — check your points balance.");
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br ${bgGradient} transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex flex-col items-center text-center px-8 max-w-xs w-full">
        <div className="text-7xl mb-4" aria-hidden="true">{emoji}</div>
        <h2 className="text-3xl font-black text-white mb-1">{title}</h2>
        <p className="text-sm text-white/60 mb-2">
          {GAME_LABELS[session.gameType] ?? session.gameType}
        </p>
        {pointsLabel && (
          <p className={`text-xl font-bold mb-2 ${pointsColor}`}>{pointsLabel}</p>
        )}
        {h2hLine ? (
          <p className="text-xs text-white/50 bg-white/10 rounded-full px-4 py-1.5 mb-4">
            {h2hLine}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-900/60 text-red-200 text-xs rounded-xl px-4 py-2 mb-4 w-full">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="flex gap-3 w-full">
          {opponent && (
            rematchId ? (
              iStartedRematch ? (
                <button
                  onClick={() => onNavigate(`/minigames/${rematchId}`)}
                  className="flex-1 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Go to rematch →
                </button>
              ) : (
                <button
                  onClick={acceptRematch}
                  disabled={rematching}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-safe:animate-pulse"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  {rematching ? "Joining…" : "Accept rematch"}
                </button>
              )
            ) : (
              <button
                onClick={startRematch}
                disabled={rematching}
                className="flex-1 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {rematching ? "Sending…" : "Rematch"}
              </button>
            )
          )}
          <button
            onClick={() => onNavigate("/minigames")}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white/80 font-medium rounded-xl transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
