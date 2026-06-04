"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useConfetti } from "@/lib/hooks/useConfetti";
import { HowToPlayModal } from "@/components/minigames/HowToPlayModal";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { sounds, isMuted, setMuted } from "@/lib/minigames/sounds";

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = { id: string; displayName: string; avatarUrl: string | null };
type Role = "host" | "guest" | "spectator";
type Employee = { id: string; displayName: string; avatarUrl: string | null };

type Session = {
  id: string;
  gameType: string;
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  state: Record<string, unknown>;
  currentTurn: string | null;
  winnerId: string | null;
  pointsWager: number;
  host: Player;
  guest: Player | null;
  myRole: Role;
  updatedAt: string;
};

const GAME_LABELS: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors",
  DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship",
  MEMORY: "Memory",
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ player, size = 40 }: { player: Player | Employee; size?: number }) {
  const s = `${size}px`;
  return player.avatarUrl ? (
    <img src={player.avatarUrl} alt={player.displayName} style={{ width: s, height: s }} className="rounded-full object-cover shrink-0" />
  ) : (
    <div style={{ width: s, height: s }} className="rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0" >
      {player.displayName[0]}
    </div>
  );
}

// ─── Invite Panel ─────────────────────────────────────────────────────────────

function InvitePanel({ sessionId, apiFetch }: { sessionId: string; apiFetch: ReturnType<typeof useApiClient>["apiFetch"] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function openDropdown() {
    setOpen(true);
    if (employees.length) return;
    setLoadingEmps(true);
    try {
      const res = await apiFetch<{ data: Employee[] }>("/api/employees");
      setEmployees(res.data);
    } finally {
      setLoadingEmps(false);
    }
  }

  async function sendInvite(emp: Employee) {
    setInviting(emp.id);
    try {
      await apiFetch(`/api/minigames/sessions/${sessionId}/invite`, {
        method: "POST",
        body: JSON.stringify({ userId: emp.id }),
      });
      setInvited(prev => new Set([...prev, emp.id]));
    } catch {
      // ignore
    } finally {
      setInviting(null);
    }
  }

  const filtered = employees.filter(e =>
    e.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openDropdown}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 text-sm font-semibold rounded-xl transition-all"
      >
        <span>👋</span> Invite coworker
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loadingEmps ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No employees found</p>
            ) : (
              filtered.slice(0, 20).map(emp => {
                const done = invited.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    onClick={() => !done && sendInvite(emp)}
                    disabled={done || inviting === emp.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${done ? "opacity-60 cursor-default" : "hover:bg-indigo-50"}`}
                  >
                    <Avatar player={emp} size={28} />
                    <span className="flex-1 text-sm text-gray-800 truncate">{emp.displayName}</span>
                    <span className={`text-xs font-semibold shrink-0 ${done ? "text-emerald-600" : "text-indigo-600"}`}>
                      {done ? "Sent ✓" : inviting === emp.id ? "…" : "Invite"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tic-Tac-Toe Board ────────────────────────────────────────────────────────

function TTTBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const board = (session.state as { board: (string | null)[] }).board;
  const myId = session.myRole === "host" ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;

  // Track the most recently filled cell for a "last move" highlight.
  const prevRef = useRef<(string | null)[]>(board);
  const [lastMove, setLastMove] = useState<number | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    let changed: number | null = null;
    for (let i = 0; i < board.length; i++) if (board[i] && !prev[i]) changed = i;
    if (changed !== null) setLastMove(changed);
    prevRef.current = board;
  }, [board]);

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
              className={`aspect-square rounded-2xl text-5xl font-bold border-2 transition-all ${
                inWin ? "border-indigo-500 bg-indigo-50 scale-105" :
                isLast ? "border-indigo-300 bg-indigo-50/40 ring-2 ring-indigo-200" :
                cell ? "border-gray-200 bg-gray-50" :
                isMyTurn ? "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 active:scale-95 cursor-pointer" :
                "border-gray-100 bg-gray-50/50 cursor-default"
              }`}
            >
              {cell === "X" && <span className="text-indigo-600">X</span>}
              {cell === "O" && <span className="text-rose-500">O</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Connect Four Board ───────────────────────────────────────────────────────

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

function C4Board({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const board = (session.state as { board: (number | null)[][] }).board;
  const myId = session.myRole === "host" ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;
  const playerNum = session.myRole === "host" ? 1 : 2;

  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // Track the most recently dropped disc for the drop animation.
  const prevRef = useRef<(number | null)[][]>(board);
  const [lastMove, setLastMove] = useState<string | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    let changed: string | null = null;
    for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) {
      if (board[c][r] && !(prev[c] && prev[c][r])) changed = `${c}-${r}`;
    }
    if (changed) setLastMove(changed);
    prevRef.current = board;
  }, [board]);

  const winCells = findC4Win(board);
  // Landing row (lowest empty) for the hovered column, for the ghost preview.
  const landingRow = hoverCol !== null ? board[hoverCol].findIndex(v => v === null) : -1;
  const ghostColor = playerNum === 1 ? "bg-yellow-400/30" : "bg-rose-500/30";

  return (
    <div className="flex flex-col items-center py-2 gap-2">
      <style>{`@keyframes c4drop{0%{transform:translateY(-230px);opacity:.5}70%{transform:translateY(0)}85%{transform:translateY(-7px)}100%{transform:translateY(0);opacity:1}}.c4-drop{animation:c4drop .35s ease-out}`}</style>
      <div className="bg-indigo-700 p-2 sm:p-2.5 rounded-2xl shadow-md w-full" style={{ width: "min(100%, 320px)" }}>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-1">
          {Array.from({ length: 7 }, (_, col) => (
            <button
              key={col}
              onClick={() => isMyTurn && onMove({ column: col })}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(c => (c === col ? null : c))}
              disabled={!isMyTurn || board[col][5] !== null}
              className="w-full h-5 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-0 transition-colors text-sm"
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
                      cell === 1 ? "bg-yellow-400 border-yellow-300 shadow-sm" :
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
        You are <span className={playerNum === 1 ? "text-yellow-600 font-semibold" : "text-rose-600 font-semibold"}>
          {playerNum === 1 ? "🟡 Yellow" : "🔴 Red"}
        </span>
        {isMyTurn && " · Click a column to drop"}
      </p>
    </div>
  );
}

// ─── Rock Paper Scissors ──────────────────────────────────────────────────────

type RPSChoice = "rock" | "paper" | "scissors";

function RPSBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
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
          <p className="text-sm text-gray-400 font-medium">Round {Math.min(state.round, state.maxRounds)} / {state.maxRounds}</p>
          <p className="text-xs text-gray-300 mt-0.5">best of {state.maxRounds}</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-900">{theirScore}</p>
          <p className="text-xs text-gray-500 mt-0.5">{opponentName}</p>
        </div>
      </div>

      {/* Round reveal */}
      {state.roundResult && (
        <div className="flex items-center justify-center gap-10 bg-gray-50 border border-gray-200 rounded-2xl py-5">
          <div className="text-center">
            <p className="text-5xl">{emojiMap[isHost ? state.roundResult.hostChoice : state.roundResult.guestChoice]}</p>
            <p className="text-xs text-gray-500 mt-1.5">You</p>
          </div>
          <p className="text-base font-bold text-gray-400">vs</p>
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
              className="flex flex-col items-center gap-2 py-6 rounded-2xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 active:scale-95 transition-all"
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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Round history</p>
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

// ─── Dots and Boxes ───────────────────────────────────────────────────────────

function DnBBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const state = session.state as {
    rows: number; cols: number;
    hLines: boolean[][]; vLines: boolean[][];
    boxes: (number | null)[][];
    score: [number, number];
  };

  const myId = session.myRole === "host" ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;
  const myNum = session.myRole === "host" ? 1 : 2;
  const { rows, cols, hLines, vLines, boxes, score } = state;
  const gridRows = 2 * rows + 1;
  const gridCols = 2 * cols + 1;

  function renderCell(gr: number, gc: number) {
    const isEvenRow = gr % 2 === 0;
    const isEvenCol = gc % 2 === 0;

    if (isEvenRow && isEvenCol) {
      return <div key={`d-${gr}-${gc}`} className="w-3 h-3 rounded-full bg-gray-600" />;
    }
    if (isEvenRow && !isEvenCol) {
      const r = gr / 2;
      const c = (gc - 1) / 2;
      const drawn = hLines[r]?.[c];
      const color = drawn ? (boxes[r]?.[c] === 1 || (r > 0 && boxes[r-1]?.[c] === 1) ? "bg-yellow-400" : boxes[r]?.[c] === 2 || (r > 0 && boxes[r-1]?.[c] === 2) ? "bg-rose-500" : "bg-gray-400") : "";
      return (
        <button
          key={`h-${r}-${c}`}
          onClick={() => isMyTurn && !drawn && onMove({ lineType: "h", row: r, col: c })}
          disabled={drawn || !isMyTurn}
          className={`h-3 w-full rounded-full transition-all ${
            drawn ? color :
            isMyTurn ? "bg-gray-200 hover:bg-indigo-400 active:bg-indigo-600 cursor-pointer" :
            "bg-gray-150 cursor-default"
          }`}
          style={{ backgroundColor: drawn ? undefined : undefined }}
        />
      );
    }
    if (!isEvenRow && isEvenCol) {
      const r = (gr - 1) / 2;
      const c = gc / 2;
      const drawn = vLines[r]?.[c];
      return (
        <button
          key={`v-${r}-${c}`}
          onClick={() => isMyTurn && !drawn && onMove({ lineType: "v", row: r, col: c })}
          disabled={drawn || !isMyTurn}
          className={`w-3 h-full rounded-full transition-all ${
            drawn ? "bg-gray-400" :
            isMyTurn ? "bg-gray-200 hover:bg-indigo-400 active:bg-indigo-600 cursor-pointer" :
            "bg-gray-150 cursor-default"
          }`}
        />
      );
    }
    const r = (gr - 1) / 2;
    const c = (gc - 1) / 2;
    const owner = boxes[r]?.[c];
    return (
      <div key={`b-${r}-${c}`} className={`rounded-lg flex items-center justify-center text-base font-bold transition-colors ${
        owner === 1 ? "bg-yellow-200 text-yellow-600" :
        owner === 2 ? "bg-rose-200 text-rose-600" :
        "bg-transparent"
      }`}>
        {owner === 1 ? "●" : owner === 2 ? "●" : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-yellow-400 mx-auto mb-1 shadow-sm" />
          <p className="text-3xl font-bold text-gray-900">{score[0]}</p>
          <p className="text-xs text-gray-500 mt-0.5">{session.host.displayName}</p>
        </div>
        <p className="text-gray-300 font-bold">—</p>
        <div className="text-center">
          <div className="w-4 h-4 rounded-full bg-rose-500 mx-auto mb-1 shadow-sm" />
          <p className="text-3xl font-bold text-gray-900">{score[1]}</p>
          <p className="text-xs text-gray-500 mt-0.5">{session.guest?.displayName ?? "Opponent"}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className="inline-grid gap-1.5 p-4 bg-gray-50 border border-gray-200 rounded-2xl"
          style={{
            gridTemplateColumns: Array.from({ length: gridCols }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
            gridTemplateRows: Array.from({ length: gridRows }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
            width: "min(100%, 360px)",
            aspectRatio: "1",
          }}
        >
          {Array.from({ length: gridRows }, (_, gr) =>
            Array.from({ length: gridCols }, (_, gc) => renderCell(gr, gc))
          )}
        </div>
      </div>

      <p className="text-xs text-center text-gray-500">
        You are <span className={myNum === 1 ? "text-yellow-600 font-semibold" : "text-rose-600 font-semibold"}>
          {myNum === 1 ? "🟡 Yellow" : "🔴 Red"}
        </span>
        {isMyTurn && " · Tap a line between dots"}
      </p>
    </div>
  );
}

// ─── Battleship Board ─────────────────────────────────────────────────────────

const BS_GRID = 8;
const BS_SHIPS_INFO = [
  { id: "battleship", size: 4, label: "Battleship" },
  { id: "cruiser",    size: 3, label: "Cruiser" },
  { id: "destroyer",  size: 2, label: "Destroyer" },
];
const SHIP_COLORS: Record<string, string> = {
  battleship: "bg-indigo-600 border-indigo-500",
  cruiser:    "bg-purple-600 border-purple-500",
  destroyer:  "bg-rose-500 border-rose-400",
};

function generateRandomPlacement() {
  const placed: number[] = [];
  const result: { id: string; cells: number[]; sunk: boolean }[] = [];
  for (const ship of BS_SHIPS_INFO) {
    let cells: number[] = [];
    for (let attempt = 0; attempt < 200; attempt++) {
      const horiz = Math.random() > 0.5;
      const row = Math.floor(Math.random() * (horiz ? BS_GRID : BS_GRID - ship.size + 1));
      const col = Math.floor(Math.random() * (horiz ? BS_GRID - ship.size + 1 : BS_GRID));
      const candidate = Array.from({ length: ship.size }, (_, i) =>
        horiz ? row * BS_GRID + col + i : (row + i) * BS_GRID + col
      );
      if (candidate.every(c => !placed.includes(c))) { cells = candidate; break; }
    }
    placed.push(...cells);
    result.push({ id: ship.id, cells, sunk: false });
  }
  return result;
}

type BSShipClient = { id: string; cells: number[]; sunk: boolean };
type BSStateClient = {
  phase: "placement" | "battle";
  hostReady: boolean; guestReady: boolean;
  hostShips: BSShipClient[]; guestShips: BSShipClient[];
  hostShots: number[]; guestShots: number[];
  hostHits: number[]; guestHits: number[];
};

function BSGrid({
  label, shipCells, shots, hits, enemyShipCells,
  clickable, onShoot,
}: {
  label: string;
  shipCells: number[];       // my own ship cells (full positions)
  shots: number[];           // shots fired on this grid
  hits: number[];            // which of those shots were hits
  enemyShipCells: number[];  // sunk enemy ship cells (for enemy grid)
  clickable: boolean;
  onShoot?: (cell: number) => void;
}) {
  return (
    <div className="w-full" style={{ maxWidth: "320px" }}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 text-center">{label}</p>
      <div className="grid gap-0.5 w-full" style={{ gridTemplateColumns: `repeat(${BS_GRID}, 1fr)` }}>
        {Array.from({ length: BS_GRID * BS_GRID }, (_, i) => {
          const isMyShip = shipCells.includes(i);
          const isSunkEnemy = enemyShipCells.includes(i);
          const isShot = shots.includes(i);
          const isHit = hits.includes(i);
          const isMiss = isShot && !isHit;
          const canClick = clickable && !isShot;
          return (
            <button
              key={i}
              onClick={() => canClick && onShoot?.(i)}
              disabled={!canClick}
              className={`w-full aspect-square rounded-sm border text-[11px] font-bold flex items-center justify-center transition-all ${
                isSunkEnemy ? "bg-red-700 border-red-800 text-white" :
                isHit && isMyShip ? "bg-red-500 border-red-600 text-white" :
                isMyShip ? "bg-slate-700 border-slate-600" :
                isHit ? "bg-orange-400 border-orange-500 text-white" :
                isMiss ? "bg-slate-200 border-slate-300 text-slate-400" :
                canClick ? "bg-blue-50 border-blue-200 hover:bg-blue-200 active:scale-95 cursor-pointer" :
                "bg-blue-50 border-blue-100 cursor-default"
              }`}
            >
              {(isHit || isSunkEnemy) ? "✕" : isMiss ? "○" : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BSBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
  const state = session.state as BSStateClient;
  const isHost = session.myRole === "host";
  const myId = isHost ? session.host.id : session.guest?.id;
  const isMyTurn = session.status === "ACTIVE" && session.currentTurn === myId;

  const myShips   = isHost ? state.hostShips   : state.guestShips;
  const enemyShips = isHost ? state.guestShips  : state.hostShips;
  const myShots   = isHost ? state.hostShots   : state.guestShots;
  const myHits    = isHost ? state.hostHits    : state.guestHits;
  const enemyShots = isHost ? state.guestShots  : state.hostShots;
  const enemyHits  = isHost ? state.guestHits   : state.hostHits;
  const myReady    = isHost ? state.hostReady   : state.guestReady;

  const [pending, setPending] = useState(generateRandomPlacement);
  const [confirming, setConfirming] = useState(false);

  // Placement phase
  if (state.phase === "placement") {
    if (myReady) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <span className="text-5xl">⚓</span>
          <p className="text-gray-700 font-semibold">Fleet deployed!</p>
          <p className="text-sm text-gray-400">Waiting for opponent to place their ships…</p>
        </div>
      );
    }
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm font-bold text-gray-700 text-center">Deploy your fleet</p>
        <div className="flex justify-center">
          <div className="grid gap-0.5 w-full" style={{ gridTemplateColumns: `repeat(${BS_GRID}, 1fr)`, maxWidth: "320px" }}>
            {Array.from({ length: BS_GRID * BS_GRID }, (_, i) => {
              const ship = pending.find(s => s.cells.includes(i));
              return (
                <div key={i} className={`w-full aspect-square rounded-sm border ${ship ? SHIP_COLORS[ship.id] : "bg-blue-50 border-blue-100"}`} />
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs">
          {BS_SHIPS_INFO.map((s, idx) => (
            <div key={s.id} className={`font-semibold ${["text-indigo-600","text-purple-600","text-rose-500"][idx]}`}>
              {s.label} ({s.size})
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setPending(generateRandomPlacement())}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
          >
            🔀 Shuffle
          </button>
          <button
            onClick={async () => { setConfirming(true); await onMove({ action: "place", ships: pending }); }}
            disabled={confirming}
            className="px-6 py-2.5 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {confirming ? "Deploying…" : "Deploy Fleet ⚓"}
          </button>
        </div>
      </div>
    );
  }

  // Battle phase
  const myShipCells = myShips.flatMap(s => s.cells);
  const sunkEnemyCells = enemyShips.filter(s => s.sunk).flatMap(s => s.cells);

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col sm:flex-row gap-5 justify-center items-center sm:items-start">
        <BSGrid
          label="My Fleet"
          shipCells={myShipCells}
          shots={enemyShots}
          hits={enemyHits}
          enemyShipCells={[]}
          clickable={false}
        />
        <BSGrid
          label={isMyTurn ? "Enemy Waters — Your turn" : "Enemy Waters"}
          shipCells={[]}
          shots={myShots}
          hits={myHits}
          enemyShipCells={sunkEnemyCells}
          clickable={isMyTurn}
          onShoot={cell => onMove({ action: "shoot", cell })}
        />
      </div>
      <div className="flex justify-center gap-4 text-xs text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded-sm bg-slate-700 mr-1" />Ship</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-orange-400 mr-1" />Hit</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-slate-200 mr-1" />Miss</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-red-700 mr-1" />Sunk</span>
      </div>
    </div>
  );
}

// ─── Memory Board ─────────────────────────────────────────────────────────────

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

function MemoryBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
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
          <p className="text-xs text-gray-400">{foundPairs}/{totalPairs} pairs</p>
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
              "bg-indigo-50 border-indigo-300";

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
                className="px-6 py-2.5 bg-[#111827] hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Flip back →
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400">Opponent is flipping cards back…</p>
          )}
        </div>
      )}

      {/* Extra-turn hint */}
      {isMyTurn && state.flipped !== null && state.revealed === null && (
        <p className="text-xs text-center text-indigo-500 font-medium">Now pick a second card!</p>
      )}
    </div>
  );
}

// ─── Mobile Status Bar (mobile-only compact strip) ───────────────────────────

function MobileBar({
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

  const rematchId = (session.state as { rematchSessionId?: string }).rematchSessionId;
  const rematchHostId = (session.state as { rematchHostId?: string }).rematchHostId;
  const iStartedRematch = !!rematchHostId && rematchHostId === myId;

  const statusColor = session.status === "FINISHED"
    ? (session.winnerId === myId ? "text-emerald-700 bg-emerald-100" : session.winnerId ? "text-red-600 bg-red-100" : "text-yellow-700 bg-yellow-100")
    : isMyTurn ? "text-indigo-700 bg-indigo-100" : "text-gray-600 bg-gray-100";
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
      alert("Couldn't join the rematch.");
    }
  }

  return (
    <div className="space-y-2">
      {/* Players + status in one compact row */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <Avatar player={me ?? session.host} size={28} />
        <span className="text-sm font-semibold text-gray-900 truncate" style={{ maxWidth: 80 }}>{me?.displayName ?? "You"}</span>
        <span className="text-[10px] text-gray-400 shrink-0">vs</span>
        {opponent
          ? <Avatar player={opponent} size={28} />
          : <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 shrink-0" />}
        <span className="text-sm font-semibold text-gray-900 truncate flex-1" style={{ maxWidth: 80 }}>{opponent?.displayName ?? "Waiting…"}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Wager */}
      {session.pointsWager > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between">
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
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors hover:border-gray-300"
        >
          📋 Copy game link
        </button>
      )}

      {/* Finished actions */}
      {session.status === "FINISHED" && (
        <div className="flex gap-2">
          {rematchId ? (
            iStartedRematch ? (
              <button onClick={() => router.push(`/minigames/${rematchId}`)} className="flex-1 py-2.5 bg-[#111827] text-white text-sm font-bold rounded-xl transition-colors">
                Go to rematch →
              </button>
            ) : (
              <button onClick={acceptRematch} disabled={rematching} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl animate-pulse transition-colors">
                {rematching ? "Joining…" : "✅ Accept rematch →"}
              </button>
            )
          ) : (
            opponent && (
              <button onClick={startRematch} disabled={rematching} className="flex-1 py-2.5 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors">
                {rematching ? "Sending…" : "🔁 Rematch"}
              </button>
            )
          )}
          <button onClick={() => router.push("/minigames")} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
            Back
          </button>
        </div>
      )}

      {/* Forfeit */}
      {session.status === "ACTIVE" && (session.myRole === "host" || session.myRole === "guest") && (
        <button onClick={onForfeit} disabled={forfeiting} className="w-full py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60 text-sm font-medium rounded-xl transition-colors">
          {forfeiting ? "Forfeiting…" : "Forfeit"}
        </button>
      )}
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function RightPanel({
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
  const [h2h, setH2h] = useState<{ wins: number; losses: number; draws: number } | null>(null);
  const [muted, setMutedState] = useState(false);
  useEffect(() => { setMutedState(isMuted()); }, []);

  const rematchId = (session.state as { rematchSessionId?: string }).rematchSessionId;
  const rematchHostId = (session.state as { rematchHostId?: string }).rematchHostId;
  const iStartedRematch = !!rematchHostId && rematchHostId === myId;

  // Head-to-head record vs this opponent, shown on the finished screen.
  useEffect(() => {
    if (session.status !== "FINISHED" || !opponent) return;
    apiFetch<{ data: { wins: number; losses: number; draws: number } }>(`/api/minigames/stats?opponentId=${opponent.id}`)
      .then(r => setH2h(r.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, opponent?.id]);

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
      alert("Couldn't join the rematch — it may have been cancelled or you're short on points.");
    }
  }

  const statusColor = session.status === "FINISHED"
    ? (session.winnerId === myId ? "text-emerald-700 bg-emerald-100" : session.winnerId ? "text-red-600 bg-red-100" : "text-yellow-700 bg-yellow-100")
    : isMyTurn ? "text-indigo-700 bg-indigo-100" : "text-gray-600 bg-gray-100";

  const statusLabel = session.status === "WAITING" ? "Waiting for opponent…"
    : session.status === "FINISHED"
      ? (!session.winnerId ? "Draw!" : session.winnerId === myId ? "You won! 🎉" : "You lost")
    : isMyTurn ? "Your turn" : "Their turn";

  return (
    <div className="space-y-3">
      {/* Players */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Me */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {me ? <Avatar player={me} /> : <div className="w-10 h-10 rounded-full bg-gray-100" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{me?.displayName ?? "You"}</p>
            <p className="text-xs text-gray-400">{session.myRole === "host" ? "Host · X / ●1" : "Guest · O / ●2"}</p>
          </div>
          <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">You</span>
        </div>

        {/* Vs divider */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">vs</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Opponent */}
        <div className="flex items-center gap-3 px-4 py-3">
          {opponent ? (
            <Avatar player={opponent} />
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">?</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{opponent?.displayName ?? "Waiting…"}</p>
            <p className="text-xs text-gray-400">{session.myRole === "host" ? "Guest · O / ●2" : "Host · X / ●1"}</p>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold ${statusColor}`}>
        {statusLabel}
      </div>

      {/* Wager */}
      {session.pointsWager > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
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
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors hover:border-gray-300"
        >
          📋 Copy game link
        </button>
      )}

      {/* Actions */}
      {session.status === "FINISHED" && (
        <div className="space-y-2">
          {h2h && opponent && (h2h.wins + h2h.losses + h2h.draws) > 0 && (
            <p className="text-center text-xs text-gray-500">
              vs {opponent.displayName}:{" "}
              <span className="font-bold text-gray-700">
                {h2h.wins}–{h2h.losses}{h2h.draws > 0 ? `–${h2h.draws}` : ""}
              </span>
              {h2h.wins > h2h.losses ? " · you lead" : h2h.wins < h2h.losses ? " · you trail" : " · all square"}
            </p>
          )}

          {rematchId ? (
            iStartedRematch ? (
              <button
                onClick={() => router.push(`/minigames/${rematchId}`)}
                className="w-full py-3 bg-[#111827] hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Go to your rematch →
              </button>
            ) : (
              <button
                onClick={acceptRematch}
                disabled={rematching}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors animate-pulse"
              >
                {rematching ? "Joining…" : "✅ Accept rematch →"}
              </button>
            )
          ) : (
            opponent && (
              <button
                onClick={startRematch}
                disabled={rematching}
                className="w-full py-3 bg-[#111827] hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {rematching ? "Sending…" : `🔁 Rematch ${opponent.displayName}`}
              </button>
            )
          )}

          <button
            onClick={() => router.push("/minigames")}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors hover:border-gray-300"
          >
            Back to lobby
          </button>
        </div>
      )}
      {session.status === "ACTIVE" && (session.myRole === "host" || session.myRole === "guest") && (
        <button
          onClick={onForfeit}
          disabled={forfeiting}
          className="w-full py-2.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60 text-sm font-medium rounded-xl transition-colors"
        >
          {forfeiting ? "Forfeiting…" : "Forfeit game"}
        </button>
      )}

      {/* Sound toggle */}
      <button
        onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }}
        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        title={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted ? "🔇 Sounds off" : "🔊 Sounds on"}
      </button>
    </div>
  );
}

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
  const prevStatus = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // Real-time: re-fetch the instant the opponent moves/joins/forfeits.
  useRealtimeChannel(session ? `game:${id}` : null, fetchSession);

  // Slow fallback poll — only catches the rare dropped Realtime message.
  // Stops once the game is over.
  useEffect(() => {
    if (!session) return;
    if (session.status === "FINISHED" || session.status === "CANCELLED") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchSession, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.status, fetchSession]);

  useEffect(() => {
    if (!session || !dbUser) return;
    const justFinished = prevStatus.current !== "FINISHED" && session.status === "FINISHED";
    if (justFinished) {
      if (session.winnerId === dbUser.id) { fire(); sounds.win(); }
      else sounds.lose();
    }
    prevStatus.current = session.status;
  }, [session?.status, session?.winnerId, dbUser?.id]);

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
      if (!msg.includes("Not your turn")) alert(msg);
    } finally {
      setMoving(false);
    }
  }

  async function forfeit() {
    if (!session || forfeiting) return;
    const confirmed = confirm("Forfeit this game? Your opponent will win.");
    if (!confirmed) return;
    setForfeiting(true);
    try {
      await apiFetch(`/api/minigames/sessions/${id}/forfeit`, { method: "POST" });
      await fetchSession();
    } finally {
      setForfeiting(false);
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto flex items-center justify-center min-h-[300px]">
      <p className="text-sm text-gray-400">Loading game…</p>
    </div>
  );

  if (!session) return (
    <div className="max-w-3xl mx-auto text-center py-20">
      <p className="text-gray-500">Game not found.</p>
      <button onClick={() => router.push("/minigames")} className="mt-4 text-indigo-600 text-sm">← Back to lobby</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {showHelp && <HowToPlayModal gameType={session.gameType} onClose={() => setShowHelp(false)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/minigames")} className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium">
          ← Lobby
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{GAME_LABELS[session.gameType] ?? session.gameType}</h1>
        <button
          onClick={() => setShowHelp(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-sm font-bold"
          title="How to play"
        >
          ?
        </button>
      </div>

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
        <div className={`w-full lg:flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl p-3 lg:p-6 transition-opacity ${moving ? "opacity-70 pointer-events-none" : ""}`}>
          {session.status === "FINISHED" && (() => {
            const won = !!dbUser && session.winnerId === dbUser.id;
            const draw = !session.winnerId;
            return (
              <div className={`mb-4 rounded-2xl py-4 text-center ${
                draw ? "bg-amber-50 border border-amber-200" :
                won ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
              }`}>
                <div className="text-4xl mb-1">{draw ? "🤝" : won ? "🏆" : "💪"}</div>
                <p className={`text-lg font-black ${draw ? "text-amber-700" : won ? "text-emerald-700" : "text-rose-600"}`}>
                  {draw ? "It's a draw!" : won ? "Victory!" : "Good game!"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {draw ? "Evenly matched." : won ? "Nicely played." : "Better luck next time."}
                </p>
              </div>
            );
          })()}
          {session.status === "WAITING" && session.gameType !== "BATTLESHIP" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-5xl mb-4">⏳</span>
              <p className="text-gray-700 font-semibold">Waiting for someone to join</p>
              <p className="text-sm text-gray-400 mt-1">Use the invite button to challenge a coworker directly.</p>
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
