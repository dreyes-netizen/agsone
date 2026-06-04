export type RPSChoice = "rock" | "paper" | "scissors";
export type RPSRoundWinner = "host" | "guest" | "draw";

export type RPSHistoryEntry = {
  hostChoice: RPSChoice;
  guestChoice: RPSChoice;
  winner: RPSRoundWinner;
};

export type RPSState = {
  round: number;
  maxRounds: number;
  hostChoice: RPSChoice | null;
  guestChoice: RPSChoice | null;
  hostScore: number;
  guestScore: number;
  roundResult: RPSHistoryEntry | null;
  history: RPSHistoryEntry[];
};

export function initRPS(maxRounds = 3): RPSState {
  return {
    round: 1, maxRounds,
    hostChoice: null, guestChoice: null,
    hostScore: 0, guestScore: 0,
    roundResult: null, history: [],
  };
}

function resolveRound(h: RPSChoice, g: RPSChoice): RPSRoundWinner {
  if (h === g) return "draw";
  if (
    (h === "rock" && g === "scissors") ||
    (h === "scissors" && g === "paper") ||
    (h === "paper" && g === "rock")
  ) return "host";
  return "guest";
}

export function applyRPSChoice(state: RPSState, choice: RPSChoice, isHost: boolean): RPSState {
  const s: RPSState = JSON.parse(JSON.stringify(state));
  if (isHost) {
    if (s.hostChoice !== null) throw new Error("Already chose this round");
    s.hostChoice = choice;
  } else {
    if (s.guestChoice !== null) throw new Error("Already chose this round");
    s.guestChoice = choice;
  }

  if (s.hostChoice && s.guestChoice) {
    const winner = resolveRound(s.hostChoice, s.guestChoice);
    const entry: RPSHistoryEntry = { hostChoice: s.hostChoice, guestChoice: s.guestChoice, winner };
    s.roundResult = entry;
    s.history.push(entry);
    if (winner === "host") s.hostScore++;
    if (winner === "guest") s.guestScore++;
    s.round++;
    s.hostChoice = null;
    s.guestChoice = null;
  } else {
    s.roundResult = null;
  }

  return s;
}

export function checkRPSResult(state: RPSState): "host" | "guest" | "draw" | null {
  if (state.round <= state.maxRounds) return null;
  const majority = Math.ceil(state.maxRounds / 2);
  if (state.hostScore >= majority) return "host";
  if (state.guestScore >= majority) return "guest";
  return "draw";
}

export function maskRPSState(state: RPSState, viewerIsHost: boolean): RPSState {
  if (state.roundResult !== null) return state;
  return {
    ...state,
    hostChoice: viewerIsHost ? state.hostChoice : (state.hostChoice ? ("hidden" as RPSChoice) : null),
    guestChoice: !viewerIsHost ? state.guestChoice : (state.guestChoice ? ("hidden" as RPSChoice) : null),
  };
}
