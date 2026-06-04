// 8×8 grid — flat index = row * 8 + col
export const BS_GRID = 8;

export const BS_SHIPS_INFO = [
  { id: "battleship", size: 4, label: "Battleship" },
  { id: "cruiser",    size: 3, label: "Cruiser" },
  { id: "destroyer",  size: 2, label: "Destroyer" },
] as const;

export type BSShip = { id: string; cells: number[]; sunk: boolean };

export type BSState = {
  phase: "placement" | "battle";
  hostReady: boolean;
  guestReady: boolean;
  hostShips: BSShip[];
  guestShips: BSShip[];
  hostShots: number[];  // shots taken by host on guest's board
  guestShots: number[]; // shots taken by guest on host's board
  hostHits: number[];   // subset of hostShots that were hits
  guestHits: number[];  // subset of guestShots that were hits
};

export function initBS(): BSState {
  return {
    phase: "placement",
    hostReady: false, guestReady: false,
    hostShips: [], guestShips: [],
    hostShots: [], guestShots: [],
    hostHits: [], guestHits: [],
  };
}

export function validateBSShips(ships: { id: string; cells: number[] }[]): boolean {
  const SIZES: Record<string, number> = { battleship: 4, cruiser: 3, destroyer: 2 };
  if (ships.length !== 3) return false;

  const ids = ships.map(s => s.id).sort().join(",");
  if (ids !== "battleship,cruiser,destroyer") return false;

  for (const ship of ships) {
    const size = SIZES[ship.id];
    if (!size || ship.cells.length !== size) return false;
    if (!ship.cells.every(c => c >= 0 && c < BS_GRID * BS_GRID)) return false;

    const rows = ship.cells.map(c => Math.floor(c / BS_GRID));
    const cols = ship.cells.map(c => c % BS_GRID);
    const sameRow = new Set(rows).size === 1;
    const sameCol = new Set(cols).size === 1;
    if (!sameRow && !sameCol) return false;

    if (sameRow) {
      const sc = [...cols].sort((a, b) => a - b);
      if (sc[sc.length - 1] - sc[0] !== size - 1) return false;
    } else {
      const sr = [...rows].sort((a, b) => a - b);
      if (sr[sr.length - 1] - sr[0] !== size - 1) return false;
    }
  }

  const all = ships.flatMap(s => s.cells);
  return new Set(all).size === all.length;
}

type PlaceMove = { action: "place"; ships: { id: string; cells: number[] }[] };
type ShootMove = { action: "shoot"; cell: number };

export function applyBSMove(state: BSState, move: PlaceMove | ShootMove, isHost: boolean): BSState {
  if (move.action === "place") {
    if (state.phase !== "placement") throw new Error("Not in placement phase");
    if (isHost ? state.hostReady : state.guestReady) throw new Error("Already placed");
    if (!validateBSShips(move.ships)) throw new Error("Invalid ship placement");

    const ships: BSShip[] = move.ships.map(s => ({ ...s, sunk: false }));
    const next: BSState = {
      ...state,
      ...(isHost ? { hostShips: ships, hostReady: true } : { guestShips: ships, guestReady: true }),
    };

    if (next.hostReady && next.guestReady) return { ...next, phase: "battle" };
    return next;
  }

  if (move.action === "shoot") {
    if (state.phase !== "battle") throw new Error("Not in battle phase");
    const myShots = isHost ? state.hostShots : state.guestShots;
    if (myShots.includes(move.cell)) throw new Error("Already shot here");
    if (move.cell < 0 || move.cell >= BS_GRID * BS_GRID) throw new Error("Out of bounds");

    const targetShips = isHost ? state.guestShips : state.hostShips;
    const newShots = [...myShots, move.cell];
    const isHit = targetShips.some(s => s.cells.includes(move.cell));
    const newHits = isHit
      ? [...(isHost ? state.hostHits : state.guestHits), move.cell]
      : (isHost ? state.hostHits : state.guestHits);

    const updatedShips = targetShips.map(s => ({
      ...s,
      sunk: s.sunk || (s.cells.includes(move.cell) && s.cells.every(c => newShots.includes(c))),
    }));

    return isHost
      ? { ...state, hostShots: newShots, hostHits: newHits, guestShips: updatedShips }
      : { ...state, guestShots: newShots, guestHits: newHits, hostShips: updatedShips };
  }

  throw new Error("Unknown action");
}

export function checkBSResult(state: BSState): "host" | "guest" | null {
  if (state.phase !== "battle") return null;
  if (state.guestShips.length > 0 && state.guestShips.every(s => s.sunk)) return "host";
  if (state.hostShips.length > 0 && state.hostShips.every(s => s.sunk)) return "guest";
  return null;
}

export function maskBSState(state: BSState, viewerIsHost: boolean): BSState {
  return {
    ...state,
    ...(viewerIsHost
      ? { guestShips: state.guestShips.map(s => ({ ...s, cells: s.sunk ? s.cells : [] })) }
      : { hostShips: state.hostShips.map(s => ({ ...s, cells: s.sunk ? s.cells : [] })) }
    ),
  };
}
