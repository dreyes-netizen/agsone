"use client";

import { useState } from "react";
import { Shuffle, Anchor } from "lucide-react";
import type { Session } from "../types";

const BS_GRID = 8;
const BS_SHIPS_INFO = [
  { id: "battleship", size: 4, label: "Battleship" },
  { id: "cruiser",    size: 3, label: "Cruiser" },
  { id: "destroyer",  size: 2, label: "Destroyer" },
];
const SHIP_COLORS: Record<string, string> = {
  battleship: "bg-navy-600 border-navy-500",
  cruiser:    "bg-amber-600 border-amber-500",
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
    <div className="w-full overflow-x-auto max-w-[320px]">
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
                isSunkEnemy ? "bg-rose-700 border-rose-800 text-white" :
                isHit && isMyShip ? "bg-rose-500 border-rose-600 text-white" :
                isMyShip ? "bg-slate-700 border-slate-600" :
                isHit ? "bg-amber-500 border-amber-600 text-white" :
                isMiss ? "bg-slate-200 border-slate-300 text-slate-400" :
                canClick ? "bg-navy-50 border-navy-200 hover:bg-navy-200 active:scale-95 cursor-pointer" :
                "bg-navy-50 border-navy-100 cursor-default"
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

export function BSBoard({ session, onMove }: { session: Session; onMove: (data: unknown) => void }) {
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
          <Anchor className="w-12 h-12 text-navy-300" aria-hidden="true" />
          <p className="text-gray-700 font-semibold">Fleet deployed!</p>
          <p className="text-sm text-gray-500">Waiting for opponent to place their ships…</p>
        </div>
      );
    }
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm font-bold text-gray-700 text-center">Deploy your fleet</p>
        <div className="flex justify-center">
          <div className="grid gap-0.5 w-full max-w-[320px]" style={{ gridTemplateColumns: `repeat(${BS_GRID}, 1fr)` }}>
            {Array.from({ length: BS_GRID * BS_GRID }, (_, i) => {
              const ship = pending.find(s => s.cells.includes(i));
              return (
                <div key={i} className={`w-full aspect-square rounded-sm border ${ship ? SHIP_COLORS[ship.id] : "bg-navy-50 border-navy-100"}`} />
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs">
          {BS_SHIPS_INFO.map((s, idx) => (
            <div key={s.id} className={`font-semibold ${["text-navy-600","text-amber-600","text-rose-500"][idx]}`}>
              {s.label} ({s.size})
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setPending(generateRandomPlacement())}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 flex items-center justify-center gap-1.5"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" /> Shuffle
          </button>
          <button
            onClick={async () => { setConfirming(true); await onMove({ action: "place", ships: pending }); }}
            disabled={confirming}
            aria-label="Deploy fleet"
            className="px-6 py-2.5 bg-command-black hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            {confirming ? "Deploying…" : <><Anchor className="w-4 h-4" aria-hidden="true" /> Deploy Fleet</>}
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
        <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-500 mr-1" />Hit</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-slate-200 mr-1" />Miss</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-rose-700 mr-1" />Sunk</span>
      </div>
    </div>
  );
}
