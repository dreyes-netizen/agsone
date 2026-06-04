export type DnBPlayer = 1 | 2;

export type DnBState = {
  rows: number;
  cols: number;
  hLines: boolean[][];   // (rows+1) × cols
  vLines: boolean[][];   // rows × (cols+1)
  boxes: (DnBPlayer | null)[][];  // rows × cols
  score: [number, number];
};

export type DnBMove =
  | { lineType: "h"; row: number; col: number }
  | { lineType: "v"; row: number; col: number };

export function initDnB(rows = 4, cols = 4): DnBState {
  return {
    rows, cols,
    hLines: Array(rows + 1).fill(null).map(() => Array(cols).fill(false)),
    vLines: Array(rows).fill(null).map(() => Array(cols + 1).fill(false)),
    boxes: Array(rows).fill(null).map(() => Array(cols).fill(null)),
    score: [0, 0],
  };
}

export function applyDnBMove(
  state: DnBState,
  move: DnBMove,
  playerNum: DnBPlayer
): { state: DnBState; extraTurn: boolean } {
  const s: DnBState = JSON.parse(JSON.stringify(state));

  if (move.lineType === "h") {
    if (move.row < 0 || move.row > s.rows || move.col < 0 || move.col >= s.cols) throw new Error("Out of bounds");
    if (s.hLines[move.row][move.col]) throw new Error("Line already drawn");
    s.hLines[move.row][move.col] = true;
  } else {
    if (move.row < 0 || move.row >= s.rows || move.col < 0 || move.col > s.cols) throw new Error("Out of bounds");
    if (s.vLines[move.row][move.col]) throw new Error("Line already drawn");
    s.vLines[move.row][move.col] = true;
  }

  let boxesCompleted = 0;
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (s.boxes[r][c] === null) {
        if (s.hLines[r][c] && s.hLines[r + 1][c] && s.vLines[r][c] && s.vLines[r][c + 1]) {
          s.boxes[r][c] = playerNum;
          s.score[playerNum - 1]++;
          boxesCompleted++;
        }
      }
    }
  }

  return { state: s, extraTurn: boxesCompleted > 0 };
}

export function checkDnBResult(state: DnBState): DnBPlayer | "draw" | null {
  const total = state.rows * state.cols;
  const filled = state.boxes.flat().filter(b => b !== null).length;
  if (filled < total) return null;
  if (state.score[0] > state.score[1]) return 1;
  if (state.score[1] > state.score[0]) return 2;
  return "draw";
}
