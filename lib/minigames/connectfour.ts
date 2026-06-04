export type C4Player = 1 | 2;
export type C4Cell = C4Player | null;
export type C4State = { board: C4Cell[][] }; // board[col][row], col 0-6, row 0=bottom

export function initC4(): C4State {
  return { board: Array(7).fill(null).map(() => Array(6).fill(null)) };
}

export function applyC4Move(state: C4State, col: number, isHost: boolean): C4State {
  if (col < 0 || col > 6) throw new Error("Invalid column");
  const board = state.board.map(c => [...c]) as C4Cell[][];
  let row = -1;
  for (let r = 0; r < 6; r++) {
    if (board[col][r] === null) { row = r; break; }
  }
  if (row === -1) throw new Error("Column full");
  board[col][row] = isHost ? 1 : 2;
  return { board };
}

export function checkC4Result(board: C4Cell[][]): C4Player | "draw" | null {
  const check = (c: number, r: number, dc: number, dr: number): C4Player | null => {
    const v = board[c]?.[r];
    if (!v) return null;
    for (let i = 1; i < 4; i++) {
      if (board[c + dc * i]?.[r + dr * i] !== v) return null;
    }
    return v;
  };

  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 6; r++) {
      const w = check(c,r,1,0) || check(c,r,0,1) || check(c,r,1,1) || check(c,r,-1,1);
      if (w) return w;
    }
  }

  if (board.every(col => col[5] !== null)) return "draw";
  return null;
}
