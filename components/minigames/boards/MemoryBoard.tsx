"use client";

import type { Session } from "../types";

type MemoryCard = { emoji: string; pairId: number };
type MemoryStateClient = {
  cards: MemoryCard[];
  matched: number[];
  flipped: number | null;
  revealed: [number, number] | null;
  revealedIsMatch: boolean;
  hostScore: number;
  guestScore: number;
};

export function MemoryBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const state = session.state as MemoryStateClient;
  const isHost = session.myRole === "host";
  const myId = isHost ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;

  function isFaceUp(i: number) {
    return state.matched.includes(i) || state.flipped === i || (state.revealed?.includes(i) ?? false);
  }

  const totalPairs = state.cards.length / 2;
  const foundPairs = state.matched.length / 2;

  return (
    <div className="space-y-4 py-2">
      {/* Scores */}
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{state.hostScore}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[80px]">{session.host.displayName}</p>
        </div>
        <div className="text-center px-2">
          <p className="text-xs text-gray-500">{foundPairs}/{totalPairs} pairs</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{state.guestScore}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[80px]">{session.guest?.displayName ?? "Opponent"}</p>
        </div>
      </div>

      {/* Card grid */}
      <div className="flex justify-center">
        <div className="grid grid-cols-4 gap-2 w-full" style={{ maxWidth: "320px" }}>
          {state.cards.map((card, i) => {
            const faceUp = isFaceUp(i);
            const isMatched = state.matched.includes(i);
            const isRevealed = state.revealed?.includes(i) ?? false;
            const canFlip = isMyTurn && !faceUp && state.revealed === null;

            const frontFace =
              isMatched ? "bg-emerald-100 border-emerald-300" :
              isRevealed ? "bg-red-50 border-red-200" :
              "bg-navy-50 border-navy-300";

            return (
              <button
                key={i}
                onClick={() => canFlip && onMove({ cardIndex: i })}
                disabled={!canFlip}
                className={`w-full aspect-square select-none ${canFlip ? "cursor-pointer active:scale-95 transition-transform" : "cursor-default"} ${isMatched ? "scale-95" : ""}`}
                style={{ perspective: "600px" }}
              >
                <div
                  className="relative w-full h-full transition-transform duration-300"
                  style={{ transformStyle: "preserve-3d", transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)" }}
                >
                  {/* Back (face-down) */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 ${canFlip ? "bg-white border-gray-200" : "bg-gray-100 border-gray-200"}`}
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                  >
                    <span className="text-gray-300 text-2xl font-bold">?</span>
                  </div>
                  {/* Front (face-up) */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 text-3xl ${frontFace}`}
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    {card.emoji}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* No-match confirm (active player only) */}
      {state.revealed && !state.revealedIsMatch && (
        <div className="text-center space-y-2">
          {isMyTurn ? (
            <>
              <p className="text-sm text-gray-500">No match — memorize them!</p>
              <button
                onClick={() => onMove({ confirm: true })}
                className="px-6 py-2.5 bg-command-black hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Flip back →
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Opponent is flipping cards back…</p>
          )}
        </div>
      )}

      {/* Extra-turn hint */}
      {isMyTurn && state.flipped !== null && state.revealed === null && (
        <p className="text-xs text-center text-navy-500 font-medium">Now pick a second card!</p>
      )}
    </div>
  );
}
