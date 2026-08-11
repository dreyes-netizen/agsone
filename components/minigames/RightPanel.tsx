"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX, Copy, Check, Repeat } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { isMuted, setMuted } from "@/lib/minigames/sounds";
import { Avatar } from "./Avatar";
import { InvitePanel } from "./InvitePanel";
import type { Session } from "./types";

// Animates · → · · → · · · to show the inactive player is waiting.
function WaitingDots() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);
  return <span aria-hidden="true">{"·".repeat(tick + 1)}</span>;
}

export function RightPanel({
  session,
  onForfeit,
  forfeiting,
  router,
  apiFetch,
}: {
  session: Session;
  onForfeit: () => void;
  forfeiting: boolean;
  router: ReturnType<typeof useRouter>;
  apiFetch: ReturnType<typeof useApiClient>["apiFetch"];
}) {
  const me = session.myRole === "host" ? session.host : session.guest;
  const opponent = session.myRole === "host" ? session.guest : session.host;
  const myId = me?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;

  const [rematching, setRematching] = useState(false);
  // Safe because RightPanel only renders client-side after `session` has
  // loaded (the page shows a loading skeleton until then), so this never
  // runs during SSR and there's no hydration-mismatch risk.
  const [muted, setMutedState] = useState(() => isMuted());
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const rematchId = (session.state as { rematchSessionId?: string }).rematchSessionId;
  const rematchHostId = (session.state as { rematchHostId?: string }).rematchHostId;
  const iStartedRematch = !!rematchHostId && rematchHostId === myId;

  async function startRematch() {
    setRematching(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>(`/api/minigames/sessions/${session.id}/rematch`, { method: "POST" });
      router.push(`/minigames/${res.data.id}`);
    } catch {
      setRematching(false);
    }
  }

  async function acceptRematch() {
    if (!rematchId) return;
    setRematching(true);
    try {
      await apiFetch(`/api/minigames/sessions/${rematchId}/join`, { method: "POST" });
      router.push(`/minigames/${rematchId}`);
    } catch {
      setRematching(false);
    }
  }

  const statusColor = session.status === "FINISHED"
    ? (session.winnerId === myId ? "text-emerald-700 bg-emerald-100" : session.winnerId ? "text-red-600 bg-red-100" : "text-yellow-700 bg-yellow-100")
    : isMyTurn ? "text-navy-700 bg-navy-100" : "text-gray-600 bg-gray-100";

  const statusLabel = session.status === "WAITING" ? "Waiting for opponent…"
    : session.status === "FINISHED"
      ? (!session.winnerId ? "Draw!" : session.winnerId === myId ? "You won! 🎉" : "You lost")
    : isMyTurn ? "Your turn" : "Their turn";

  return (
    <div className="space-y-3">
      {/* Players — active player glows, inactive dims */}
      <div className="bg-white border border-table-border rounded-card overflow-hidden">
        {/* Me */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 transition-opacity ${session.status === "ACTIVE" && !isMyTurn ? "opacity-50" : ""}`}>
          <div className={session.status === "ACTIVE" && isMyTurn ? "rounded-full ring-4 ring-navy-100" : "rounded-full"}>
            {me ? <Avatar player={me} /> : <div className="w-10 h-10 rounded-full bg-gray-100" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{me?.displayName ?? "You"}</p>
            {session.status === "ACTIVE" && isMyTurn ? (
              <p className="text-xs text-navy-600 font-semibold">▶ Your turn</p>
            ) : session.status === "ACTIVE" ? (
              <p className="text-xs text-gray-500">Waiting <WaitingDots /></p>
            ) : (
              <p className="text-xs text-gray-500">{session.myRole === "host" ? "Host · X / ●1" : "Guest · O / ●2"}</p>
            )}
          </div>
          <span className="text-xs text-navy-600 font-semibold bg-navy-50 px-2 py-0.5 rounded-full shrink-0">You</span>
        </div>

        {/* Vs divider */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">vs</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Opponent */}
        <div className={`flex items-center gap-3 px-4 py-3 transition-opacity ${session.status === "ACTIVE" && isMyTurn ? "opacity-50" : ""}`}>
          {opponent ? (
            <div className={session.status === "ACTIVE" && !isMyTurn ? "rounded-full ring-4 ring-navy-100" : "rounded-full"}>
              <Avatar player={opponent} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">?</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{opponent?.displayName ?? "Waiting…"}</p>
            {session.status === "ACTIVE" && !isMyTurn ? (
              <p className="text-xs text-navy-600 font-semibold">▶ Their turn</p>
            ) : session.status === "ACTIVE" ? (
              <p className="text-xs text-gray-500">Waiting <WaitingDots /></p>
            ) : (
              <p className="text-xs text-gray-500">{session.myRole === "host" ? "Guest · O / ●2" : "Host · X / ●1"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status badge — only shown while waiting for opponent */}
      {session.status === "WAITING" && (
        <div className="rounded-xl px-4 py-2.5 text-center text-sm font-bold text-gray-600 bg-gray-100">
          Waiting for opponent…
        </div>
      )}

      {/* Wager */}
      {session.pointsWager > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-amber-700 font-medium">Wager each</span>
          <span className="text-sm font-bold text-amber-800">{session.pointsWager} pts</span>
        </div>
      )}

      {/* Invite (only when waiting and I'm host) */}
      {session.status === "WAITING" && session.myRole === "host" && (
        <InvitePanel sessionId={session.id} apiFetch={apiFetch} />
      )}

      {/* Copy link (backup invite) */}
      {session.status === "WAITING" && (
        <button
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy game link"}
          className="w-full py-2 text-xs border border-gray-200 rounded-xl transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /><span className="text-emerald-600 font-medium">Copied!</span></>
            : <><Copy className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /><span className="text-gray-500 hover:text-gray-700">Copy game link</span></>}
        </button>
      )}

      {/* Actions */}
      {session.status === "FINISHED" && (
        <div className="space-y-2">
          {rematchId ? (
            iStartedRematch ? (
              <button
                onClick={() => router.push(`/minigames/${rematchId}`)}
                className="w-full py-3 bg-command-black hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Go to your rematch →
              </button>
            ) : (
              <button
                onClick={acceptRematch}
                disabled={rematching}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors motion-safe:animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                {rematching ? "Joining…" : "Accept rematch"}
              </button>
            )
          ) : (
            opponent && (
              <button
                onClick={startRematch}
                disabled={rematching}
                className="w-full py-3 bg-command-black hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {rematching ? "Sending…" : <><Repeat className="w-4 h-4" aria-hidden="true" /> Rematch {opponent.displayName}</>}
              </button>
            )
          )}

          <button
            onClick={() => router.push("/minigames")}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
          >
            Back to lobby
          </button>
        </div>
      )}
      {session.status === "ACTIVE" && (session.myRole === "host" || session.myRole === "guest") && (
        <button
          onClick={onForfeit}
          disabled={forfeiting}
          className="w-full py-2.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60 text-sm font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
        >
          {forfeiting ? "Forfeiting…" : "Forfeit game"}
        </button>
      )}

      {/* Sound toggle */}
      <button
        onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }}
        aria-pressed={muted}
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 rounded-xl"
      >
        {muted
          ? <><VolumeX className="w-3.5 h-3.5" aria-hidden="true" /> Sounds off</>
          : <><Volume2 className="w-3.5 h-3.5" aria-hidden="true" /> Sounds on</>}
      </button>
    </div>
  );
}
