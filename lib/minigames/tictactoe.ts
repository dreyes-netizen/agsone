export type TTTMark = "X" | "O";
export type TTTCell = TTTMark | null;
export type TTTState = { board: TTTCell[] };

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

export function initTTT(): TTTState {
  return { board: Array(9).fill(null) };
}

export function applyTTTMove(state: TTTState, cellIndex: number, isHost: boolean): TTTState {
  if (cellIndex < 0 || cellIndex > 8) throw new Error("Invalid cell");
  if (state.board[cellIndex] !== null) throw new Error("Cell taken");
  const board = [...state.board] as TTTCell[];
  board[cellIndex] = isHost ? "X" : "O";
  return { board };
}

export function checkTTTResult(board: TTTCell[]): TTTMark | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]!;
  }
  if (board.every(c => c !== null)) return "draw";
  return null;
}
