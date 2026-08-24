"use client";

import { Gamepad2, Loader2 } from "lucide-react";
import { GAME_TYPE_LABELS, type GameTypeKey } from "@/lib/constants/gameTypes";

const GAME_LABEL = GAME_TYPE_LABELS;

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

type Props = {
  sessions: Session[];
  loading: boolean;
  joining: string | null;
  onJoin: (sessionId: string) => void;
};

// Subtitle text for one open-challenge row. Chess carries its time control in
// `settings`, so it gets a richer "Chess · 5 min · 25 pts" format; every other
// game keeps the original "<Label> · <wager>" format unchanged. Guards against
// malformed/missing Chess settings so a bad row can't crash the whole lobby.
function sessionMeta(session: Session): string {
  const wagerText = session.pointsWager > 0 ? `${session.pointsWager} pts` : "Free";

  if (session.gameType === "CHESS") {
    const minutes = (session.settings as { timeControlMinutes?: number } | null)?.timeControlMinutes;
    if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
      return "Chess · Quick · Free";
    }
    return `Chess · ${minutes} min · ${wagerText}`;
  }

  return `${GAME_LABEL[session.gameType]} · ${wagerText}`;
}

export function OpenChallengesPanel({ sessions, loading, joining, onJoin }: Props) {
  return (
    <div className="bg-white border border-table-border rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Open Challenges</p>
        <span className="text-xs text-gray-500">{sessions.length > 0 ? `${sessions.length} open · all games` : "all games"}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Gamepad2 className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-600 font-medium">No open challenges yet</p>
            <p className="text-xs text-gray-500 mt-1">Create one and invite a coworker!</p>
          </div>
        ) : (
          sessions.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              {s.host.avatarUrl ? (
                <img src={s.host.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold shrink-0">
                  {s.host.displayName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{s.host.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{sessionMeta(s)}</p>
              </div>
              <button
                onClick={() => onJoin(s.id)}
                disabled={joining === s.id}
                className="shrink-0 px-4 py-2 bg-command-black hover:bg-gray-800 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors min-w-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
              >
                {joining === s.id ? "…" : "Join"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
