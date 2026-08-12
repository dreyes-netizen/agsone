"use client";

import { useState } from "react";
import type { Session } from "../types";

// Find the four winning cells in a Connect Four board (board[col][row]).
function findC4Win(board: (number | null)[][]): Set<string> | null {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 6; r++) {
      const v = board[c][r];
      if (!v) continue;
      for (const [dc, dr] of dirs) {
        const cells = [`${c}-${r}`];
        let nc = c + dc, nr = r + dr;
        while (nc >= 0 && nc < 7 && nr >= 0 && nr < 6 && board[nc][nr] === v) {
          cells.push(`${nc}-${nr}`);
          nc += dc; nr += dr;
        }
        if (cells.length >= 4) return new Set(cells);
      }
    }
  }
  return null;
}

export function C4Board({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const board = (session.state as { board: (number | null)[][] }).board;
  const myId = session.myRole === "host" ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;
  const playerNum = session.myRole === "host" ? 1 : 2;

  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // Track the most recently dropped disc for the drop animation.
  const [prevBoard, setPrevBoard] = useState(board);
  const [lastMove, setLastMove] = useState<string | null>(null);
  if (board !== prevBoard) {
    let changed: string | null = null;
    for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) {
      if (board[c][r] && !(prevBoard[c] && prevBoard[c][r])) changed = `${c}-${r}`;
    }
    if (changed) setLastMove(changed);
    setPrevBoard(board);
  }

  const winCells = findC4Win(board);
  // Landing row (lowest empty) for the hovered column, for the ghost preview.
  const landingRow = hoverCol !== null ? board[hoverCol].findIndex(v => v === null) : -1;
  const ghostColor = playerNum === 1 ? "bg-navy-600/30" : "bg-rose-500/30";

  return (
    <div className="flex flex-col items-center py-2 gap-2">
      <style>{`@keyframes c4drop{0%{transform:translateY(-230px);opacity:.5}70%{transform:translateY(0)}85%{transform:translateY(-7px)}100%{transform:translateY(0);opacity:1}}.c4-drop{animation:c4drop .35s ease-out}`}</style>
      <div className="bg-navy-700 p-2 sm:p-2.5 rounded-2xl shadow-md w-full">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-1">
          {Array.from({ length: 7 }, (_, col) => (
            <button
              key={col}
              aria-label={`Drop in column ${col + 1}`}
              onClick={() => isMyTurn && onMove({ column: col })}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(c => (c === col ? null : c))}
              disabled={!isMyTurn || board[col][5] !== null}
              className="w-full h-8 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-0 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset"
            >
              ▼
            </button>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, displayRow) => {
          const row = 5 - displayRow;
          return (
            <div key={row} className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              {Array.from({ length: 7 }, (_, col) => {
                const cell = board[col][row];
                const key = `${col}-${row}`;
                const inWin = winCells?.has(key);
                const isLast = lastMove === key;
                const isGhost = isMyTurn && !cell && hoverCol === col && landingRow === row;
                return (
                  <div
                    key={col}
                    onMouseEnter={() => isMyTurn && setHoverCol(col)}
                    onClick={() => isMyTurn && !cell && onMove({ column: col })}
                    className={`w-full aspect-square rounded-full border-2 transition-all ${isLast ? "c4-drop" : ""} ${
                      cell === 1 ? "bg-navy-600 border-navy-500 shadow-sm" :
                      cell === 2 ? "bg-rose-500 border-rose-400 shadow-sm" :
                      isGhost ? `${ghostColor} border-white/20 cursor-pointer` :
                      "bg-white/10 border-white/5"
                    } ${inWin ? "ring-4 ring-white scale-105" : ""}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">
        You are <span className={`inline-flex items-center gap-1 align-middle ${playerNum === 1 ? "text-navy-600 font-semibold" : "text-rose-600 font-semibold"}`}>
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${playerNum === 1 ? "bg-navy-600" : "bg-rose-500"}`} aria-hidden="true" />
          {playerNum === 1 ? "Navy" : "Red"}
        </span>
        {isMyTurn && " · Click a column to drop"}
      </p>
    </div>
  );
}
