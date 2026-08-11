"use client";

import { useState } from "react";
import type { Session } from "../types";

export function TTTBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const board = (session.state as { board: (string | null)[] }).board;
  const myId = session.myRole === "host" ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;

  // Track the most recently filled cell for a "last move" highlight.
  const [prevBoard, setPrevBoard] = useState(board);
  const [lastMove, setLastMove] = useState<number | null>(null);
  if (board !== prevBoard) {
    let changed: number | null = null;
    for (let i = 0; i < board.length; i++) if (board[i] && !prevBoard[i]) changed = i;
    if (changed !== null) setLastMove(changed);
    setPrevBoard(board);
  }

  const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let winLine: number[] | null = null;
  for (const line of WIN_LINES) {
    if (board[line[0]] && board[line[0]] === board[line[1]] && board[line[0]] === board[line[2]]) {
      winLine = line; break;
    }
  }

  return (
    <div className="flex justify-center py-2">
      <div className="grid grid-cols-3 gap-3 w-full max-w-[340px]">
        {board.map((cell, i) => {
          const inWin = winLine?.includes(i);
          const isLast = lastMove === i && !winLine;
          return (
            <button
              key={i}
              onClick={() => isMyTurn && !cell && onMove({ cellIndex: i })}
              disabled={!isMyTurn || !!cell}
              aria-label={`Row ${Math.floor(i / 3) + 1}, Column ${(i % 3) + 1}${cell ? ` — ${cell}` : " — empty"}`}
              aria-pressed={!!cell}
              className={`aspect-square rounded-2xl text-5xl font-bold border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                inWin ? "border-navy-500 bg-navy-50 scale-105" :
                isLast ? "border-navy-300 bg-navy-50/40 ring-2 ring-navy-200" :
                cell ? "border-gray-200 bg-gray-50" :
                isMyTurn ? "border-gray-200 hover:border-navy-400 hover:bg-navy-50/50 active:scale-95 cursor-pointer" :
                "border-gray-100 bg-gray-50/50 cursor-default"
              }`}
            >
              {cell === "X" && <span className="text-navy-600" aria-hidden="true">X</span>}
              {cell === "O" && <span className="text-rose-500" aria-hidden="true">O</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
