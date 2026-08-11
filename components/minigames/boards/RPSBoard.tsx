"use client";

import type { Session } from "../types";

type RPSChoice = "rock" | "paper" | "scissors";

export function RPSBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const state = session.state as {
    round: number; maxRounds: number;
    hostChoice: RPSChoice | null; guestChoice: RPSChoice | null;
    hostScore: number; guestScore: number;
    roundResult: { hostChoice: RPSChoice; guestChoice: RPSChoice; winner: string } | null;
    history: { hostChoice: RPSChoice; guestChoice: RPSChoice; winner: string }[];
  };

  const isHost = session.myRole === "host";
  const myChoice = isHost ? state.hostChoice : state.guestChoice;
  const theirChoice = isHost ? state.guestChoice : state.hostChoice;
  const myScore = isHost ? state.hostScore : state.guestScore;
  const theirScore = isHost ? state.guestScore : state.hostScore;
  const opponentName = isHost ? (session.guest?.displayName ?? "Opponent") : session.host.displayName;
  const canPick = session.status === "ACTIVE" && !myChoice;

  const CHOICES: { key: RPSChoice; emoji: string; label: string }[] = [
    { key: "rock",     emoji: "🪨", label: "Rock" },
    { key: "paper",    emoji: "📄", label: "Paper" },
    { key: "scissors", emoji: "✂️", label: "Scissors" },
  ];
  const emojiMap: Record<RPSChoice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };

  return (
    <div className="space-y-5 py-2">
      {/* Score */}
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-900">{myScore}</p>
          <p className="text-xs text-gray-500 mt-0.5">You</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 font-medium">Round {Math.min(state.round, state.maxRounds)} / {state.maxRounds}</p>
          <p className="text-xs text-gray-300 mt-0.5">best of {state.maxRounds}</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-900">{theirScore}</p>
          <p className="text-xs text-gray-500 mt-0.5">{opponentName}</p>
        </div>
      </div>

      {/* Round reveal */}
      {state.roundResult && (
        <div className="flex items-center justify-center gap-10 bg-gray-50 border border-table-border rounded-card py-5">
          <div className="text-center">
            <p className="text-5xl">{emojiMap[isHost ? state.roundResult.hostChoice : state.roundResult.guestChoice]}</p>
            <p className="text-xs text-gray-500 mt-1.5">You</p>
          </div>
          <p className="text-base font-bold text-gray-500">vs</p>
          <div className="text-center">
            <p className="text-5xl">{emojiMap[isHost ? state.roundResult.guestChoice : state.roundResult.hostChoice]}</p>
            <p className="text-xs text-gray-500 mt-1.5">Them</p>
          </div>
        </div>
      )}

      {/* Waiting banner after picked */}
      {session.status === "ACTIVE" && !state.roundResult && myChoice && !theirChoice && (
        <div className="text-center py-5">
          <p className="text-5xl mb-3">{emojiMap[myChoice]}</p>
          <p className="text-sm text-gray-500">Waiting for opponent to pick…</p>
        </div>
      )}

      {/* Choices */}
      {canPick && (
        <div className="grid grid-cols-3 gap-3">
          {CHOICES.map(c => (
            <button
              key={c.key}
              onClick={() => onMove({ choice: c.key })}
              className="flex flex-col items-center gap-2 py-6 rounded-2xl border-2 border-gray-200 hover:border-navy-400 hover:bg-navy-50/50 active:scale-95 transition-all"
            >
              <span className="text-4xl">{c.emoji}</span>
              <span className="text-xs font-semibold text-gray-600">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* History */}
      {state.history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Round history</p>
          {state.history.map((h, i) => {
            const mine = isHost ? h.hostChoice : h.guestChoice;
            const theirs = isHost ? h.guestChoice : h.hostChoice;
            const w = isHost ? h.winner === "host" : h.winner === "guest";
            return (
              <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl ${w ? "bg-emerald-50 text-emerald-700" : h.winner === "draw" ? "bg-gray-50 text-gray-500" : "bg-red-50 text-red-500"}`}>
                <span className="font-medium">{emojiMap[mine]} You</span>
                <span className="font-bold">{w ? "Won" : h.winner === "draw" ? "Draw" : "Lost"}</span>
                <span className="font-medium">Them {emojiMap[theirs]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
