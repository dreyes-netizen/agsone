"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Avatar } from "./Avatar";
import { InvitePanel } from "./InvitePanel";
import type { Session } from "./types";

export function MobileBar({
  session, myId, forfeiting, onForfeit, router, apiFetch,
}: {
  session: Session;
  myId: string | undefined;
  forfeiting: boolean;
  onForfeit: () => void;
  router: ReturnType<typeof useRouter>;
  apiFetch: ReturnType<typeof useApiClient>["apiFetch"];
}) {
  const me = session.myRole === "host" ? session.host : session.guest;
  const opponent = session.myRole === "host" ? session.guest : session.host;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;
  const [rematching, setRematching] = useState(false);
  const [copied, setCopied] = useState(false);

  const rematchId = (session.state as { rematchSessionId?: string }).rematchSessionId;
  const rematchHostId = (session.state as { rematchHostId?: string }).rematchHostId;
  const iStartedRematch = !!rematchHostId && rematchHostId === myId;

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusColor = session.status === "FINISHED"
    ? (session.winnerId === myId ? "text-emerald-700 bg-emerald-100" : session.winnerId ? "text-red-600 bg-red-100" : "text-yellow-700 bg-yellow-100")
    : isMyTurn ? "text-navy-700 bg-navy-100" : "text-gray-600 bg-gray-100";
  const statusLabel = session.status === "WAITING" ? "Waiting…"
    : session.status === "FINISHED"
      ? (!session.winnerId ? "Draw!" : session.winnerId === myId ? "You won! 🎉" : "You lost")
      : isMyTurn ? "Your turn" : "Their turn";

  async function startRematch() {
    setRematching(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>(`/api/minigames/sessions/${session.id}/rematch`, { method: "POST" });
      router.push(`/minigames/${res.data.id}`);
    } catch { setRematching(false); }
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

  return (
    <div className="space-y-2">
      {/* Players + status in one compact row */}
      <div className="bg-white border border-table-border rounded-card px-3 py-2 flex items-center gap-2">
        {/* Me */}
        <div className={`rounded-full shrink-0 ${session.status === "ACTIVE" && isMyTurn ? "ring-2 ring-navy-500 ring-offset-1" : ""}`}>
          <Avatar player={me ?? session.host} size={28} />
        </div>
        <div className="flex flex-col min-w-0" style={{ maxWidth: 80 }}>
          <span className="text-sm font-semibold text-gray-900 truncate">{me?.displayName ?? "You"}</span>
          {session.status === "ACTIVE" && isMyTurn && (
            <span className="text-[9px] text-navy-600 font-bold leading-tight">● Your turn</span>
          )}
        </div>

        <span className="text-[10px] text-gray-500 shrink-0">vs</span>

        {/* Opponent */}
        <div className={`rounded-full shrink-0 ${session.status === "ACTIVE" && !isMyTurn && opponent ? "ring-2 ring-navy-500 ring-offset-1" : ""}`}>
          {opponent
            ? <Avatar player={opponent} size={28} />
            : <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300" />}
        </div>
        <div className="flex flex-col flex-1 min-w-0" style={{ maxWidth: 80 }}>
          <span className="text-sm font-semibold text-gray-900 truncate">{opponent?.displayName ?? "Waiting…"}</span>
          {session.status === "ACTIVE" && !isMyTurn && opponent && (
            <span className="text-[9px] text-navy-600 font-bold leading-tight">● Their turn</span>
          )}
        </div>

        {/* Status pill — only for WAITING/FINISHED states */}
        {session.status !== "ACTIVE" && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>{statusLabel}</span>
        )}
      </div>

      {/* Wager */}
      {session.pointsWager > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-card px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs text-amber-700 font-medium">Wager</span>
          <span className="text-sm font-bold text-amber-800">{session.pointsWager} pts</span>
        </div>
      )}

      {/* Invite (WAITING + host) */}
      {session.status === "WAITING" && session.myRole === "host" && (
        <InvitePanel sessionId={session.id} apiFetch={apiFetch} />
      )}
      {session.status === "WAITING" && (
        <button
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy game link"}
          className="w-full py-1.5 text-xs border border-gray-200 rounded-xl transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /><span className="text-emerald-600 font-medium">Copied!</span></>
            : <><Copy className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /><span className="text-gray-500 hover:text-gray-700">Copy game link</span></>}
        </button>
      )}

      {/* Finished actions */}
      {session.status === "FINISHED" && (
        <div className="flex gap-2">
          {rematchId ? (
            iStartedRematch ? (
              <button onClick={() => router.push(`/minigames/${rematchId}`)} className="flex-1 py-2.5 bg-command-black text-white text-sm font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
                Go to rematch →
              </button>
            ) : (
              <button onClick={acceptRematch} disabled={rematching} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl motion-safe:animate-pulse transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" aria-hidden="true" />
                {rematching ? "Joining…" : "Accept rematch"}
              </button>
            )
          ) : (
            opponent && (
              <button onClick={startRematch} disabled={rematching} className="flex-1 py-2.5 bg-command-black hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5">
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {rematching ? "Sending…" : "Rematch"}
              </button>
            )
          )}
          <button onClick={() => router.push("/minigames")} aria-label="Back to lobby" className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900">
            Back
          </button>
        </div>
      )}

      {/* Forfeit */}
      {session.status === "ACTIVE" && (session.myRole === "host" || session.myRole === "guest") && (
        <button onClick={onForfeit} disabled={forfeiting} className="w-full py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60 text-sm font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500">
          {forfeiting ? "Forfeiting…" : "Forfeit"}
        </button>
      )}
    </div>
  );
}
