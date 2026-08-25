"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { activeChessRole, getChessClock, isChessUntimed, type ChessRole, type ChessState } from "@/lib/minigames/chess";
import type { useApiClient } from "@/lib/hooks/useApiClient";
import { ChessClock } from "./ChessClock";
import { ChessPromotionPicker } from "./ChessPromotionPicker";
import type { Session } from "../types";

// This is the ONLY module in the codebase that imports `react-chessboard` —
// keep it that way so the game room can `next/dynamic`-lazy-load this one
// component without pulling the chess UI library into the shared bundle.

type ChessPromotion = "q" | "r" | "b" | "n";

type ChessMovePayload = {
  from: string;
  to: string;
  promotion?: ChessPromotion;
};

type Props = {
  session: Session;
  onMove: (data: ChessMovePayload) => Promise<boolean>;
  apiFetch: ReturnType<typeof useApiClient>["apiFetch"];
  onSessionRefresh: () => Promise<void>;
};

const LAST_MOVE_STYLE: CSSProperties = {
  backgroundColor: "color-mix(in oklch, var(--color-navy-400) 35%, transparent)",
};

export function ChessBoard({ session, onMove, apiFetch, onSessionRefresh }: Props) {
  // `session.state` is server-authoritative — this component never owns or
  // mutates it. `chessState` is just a typed view over it, re-derived every
  // render straight from props.
  const chessState = session.state as unknown as ChessState;

  const orientation: "white" | "black" =
    session.myRole === "guest" ? "black" : "white";

  const myId =
    session.myRole === "host"
      ? session.host.id
      : session.myRole === "guest"
        ? session.guest?.id
        : null;

  const canMove =
    session.status === "ACTIVE" &&
    session.myRole !== "spectator" &&
    session.currentTurn === myId;

  // `viewFen` is a UI-only optimistic preview, never authoritative. It is
  // seeded from — and always resynced to — `chessState.fen` the moment the
  // server state changes (a move lands, a refresh completes, etc). Adjusted
  // directly during render (React's documented pattern for resetting state
  // when a prop changes) rather than in a `useEffect`, so the resync commits
  // in the same pass instead of a follow-up render — same technique already
  // used by `C4Board.tsx` for its last-move tracking.
  const [viewFen, setViewFen] = useState(chessState.fen);
  const [syncedFen, setSyncedFen] = useState(chessState.fen);
  if (chessState.fen !== syncedFen) {
    setSyncedFen(chessState.fen);
    setViewFen(chessState.fen);
  }

  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const untimed = isChessUntimed(chessState);

  // Local ticking clock, display-only. `nowMs` never gets written back
  // anywhere — the actual remaining-time math is delegated to the shared
  // pure `getChessClock`, imported from the same module the server uses. A
  // no-limit game's clock never moves, so there is nothing to tick.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (session.status !== "ACTIVE" || untimed) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [session.status, untimed]);

  const clock = useMemo(
    () => getChessClock(chessState, new Date(nowMs)),
    [chessState, nowMs],
  );

  const activeRole: ChessRole = activeChessRole(chessState);

  // Claim the timeout exactly once when the displayed active clock reaches
  // zero. The in-flight guard is a `ref`, not state, so a burst of interval
  // ticks in the same 250ms window can never race two claims through. Moves
  // are disabled the moment `clock.expiredRole` is set (see `clockExpired`
  // below) rather than via a second piece of "claiming" state, so there's no
  // synchronous `setState` in this effect's body — only the async fetch's
  // callbacks touch state, which is the pattern the lint rule wants.
  const timeoutClaimInFlight = useRef(false);

  useEffect(() => {
    const isActiveParticipant = session.myRole === "host" || session.myRole === "guest";
    if (
      session.status !== "ACTIVE" ||
      !isActiveParticipant ||
      clock.expiredRole === null ||
      timeoutClaimInFlight.current
    ) {
      return;
    }

    timeoutClaimInFlight.current = true;

    apiFetch(`/api/minigames/sessions/${session.id}/timeout`, { method: "POST" })
      .then(() => onSessionRefresh())
      .catch(() => onSessionRefresh())
      .finally(() => {
        timeoutClaimInFlight.current = false;
      });
  }, [clock.expiredRole, session.status, session.myRole, session.id, apiFetch, onSessionRefresh]);

  // The active side's clock has hit zero — moves are locked immediately
  // (before the API round-trip above even resolves) so a slow network can't
  // let a flagged player sneak a move in.
  const clockExpired = clock.expiredRole !== null;

  // Runs a move through chess.js locally, purely to (a) validate immediate
  // geometry for the optimistic preview and (b) get the resulting FEN. This
  // is NEVER treated as the legality ruling — the server can still reject a
  // locally-legal move (clock expired, a concurrent update already landed).
  function previewLocalMove(from: string, to: string, promotion?: ChessPromotion) {
    const localGame = new Chess(viewFen);
    try {
      localGame.move({ from: from as Square, to: to as Square, promotion });
    } catch {
      return null;
    }
    return localGame.fen();
  }

  // Fires the async server move as a background continuation. Never awaited
  // from inside `onPieceDrop` — that handler must return a plain `boolean`
  // synchronously for react-chessboard, so the actual server round-trip
  // happens after the (already synchronous) optimistic UI update.
  function sendMove(payload: ChessMovePayload) {
    onMove(payload)
      .then((accepted) => {
        if (!accepted) setViewFen(chessState.fen);
      })
      .catch(() => setViewFen(chessState.fen));
  }

  function onPieceDrop({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!canMove || clockExpired || !targetSquare) return false;

    const pieceColor = piece.pieceType.startsWith("w") ? "white" : "black";
    const isPawn = piece.pieceType.endsWith("P");
    const targetRank = targetSquare[1];
    const isPromotion =
      isPawn &&
      ((pieceColor === "white" && targetRank === "8") ||
        (pieceColor === "black" && targetRank === "1"));

    if (isPromotion) {
      // Don't send yet, and don't move the piece visually — wait for the
      // user to choose a piece in the picker.
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }

    const preview = previewLocalMove(sourceSquare, targetSquare);
    if (!preview) return false; // locally illegal — react-chessboard snaps back on its own

    setViewFen(preview);
    sendMove({ from: sourceSquare, to: targetSquare });
    return true;
  }

  function confirmPromotion(promotion: ChessPromotion) {
    const move = pendingPromotion;
    setPendingPromotion(null);
    if (!move) return;

    const preview = previewLocalMove(move.from, move.to, promotion);
    if (!preview) return;

    setViewFen(preview);
    sendMove({ from: move.from, to: move.to, promotion });
  }

  const lastMoveStyles = useMemo(() => {
    if (!chessState.lastMove) return {};
    return {
      [chessState.lastMove.from]: LAST_MOVE_STYLE,
      [chessState.lastMove.to]: LAST_MOVE_STYLE,
    };
  }, [chessState.lastMove]);

  const bottomRole: ChessRole = orientation === "white" ? "host" : "guest";
  const topRole: ChessRole = bottomRole === "host" ? "guest" : "host";

  const msFor = (role: ChessRole) => (role === "host" ? clock.whiteMs : clock.blackMs);
  const labelFor = (role: ChessRole) =>
    role === "host" ? session.host.displayName : (session.guest?.displayName ?? "Guest");

  const [drawActionPending, setDrawActionPending] = useState(false);
  const isParticipant = session.myRole === "host" || session.myRole === "guest";
  const drawOfferBy = chessState.drawOfferBy;
  const opponentOfferedDraw =
    isParticipant && drawOfferBy !== null && drawOfferBy !== session.myRole;
  const iOfferedDraw =
    isParticipant && drawOfferBy !== null && drawOfferBy === session.myRole;

  async function handleDraw(action: "offer" | "accept" | "decline") {
    setDrawActionPending(true);
    try {
      await apiFetch(`/api/minigames/sessions/${session.id}/draw`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
    } catch {
      // Swallow — the refresh below reflects the true server state either way.
    } finally {
      setDrawActionPending(false);
      await onSessionRefresh();
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="w-full max-w-[420px]">
        <ChessClock
          label={labelFor(topRole)}
          ms={msFor(topRole)}
          active={session.status === "ACTIVE" && activeRole === topRole}
          unlimited={untimed}
        />
      </div>

      <div className="relative w-full max-w-[420px]">
        <Chessboard
          options={{
            id: `ags-chess-${session.id}`,
            position: viewFen,
            boardOrientation: orientation,
            onPieceDrop,
            allowDragging: canMove && !pendingPromotion && !clockExpired,
            animationDurationInMs: 180,
            squareStyles: lastMoveStyles,
          }}
        />
        {pendingPromotion && (
          <ChessPromotionPicker
            color={orientation === "white" ? "white" : "black"}
            onSelect={confirmPromotion}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>

      <div className="w-full max-w-[420px]">
        <ChessClock
          label={labelFor(bottomRole)}
          ms={msFor(bottomRole)}
          active={session.status === "ACTIVE" && activeRole === bottomRole}
          unlimited={untimed}
        />
      </div>

      {isParticipant && session.status === "ACTIVE" && (
        <div className="mt-2 flex justify-center">
          {opponentOfferedDraw ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Opponent offered a draw</span>
              <button
                type="button"
                onClick={() => handleDraw("accept")}
                disabled={drawActionPending}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => handleDraw("decline")}
                disabled={drawActionPending}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1"
              >
                Decline
              </button>
            </div>
          ) : iOfferedDraw ? (
            <span className="text-sm text-gray-500">Draw offer sent</span>
          ) : (
            <button
              type="button"
              onClick={() => handleDraw("offer")}
              disabled={drawActionPending}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1"
            >
              Offer draw
            </button>
          )}
        </div>
      )}
    </div>
  );
}
