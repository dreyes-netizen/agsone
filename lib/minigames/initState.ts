import { initTTT } from "./tictactoe";
import { initC4 } from "./connectfour";
import { initRPS } from "./rps";
import { initDnB } from "./dotsandboxes";
import { initBS } from "./battleship";
import { initMemory } from "./memory";

export const GAME_TYPES = [
  "TIC_TAC_TOE",
  "CONNECT_FOUR",
  "RPS",
  "DOTS_AND_BOXES",
  "BATTLESHIP",
  "MEMORY",
] as const;

export type GameType = (typeof GAME_TYPES)[number];

/** Build the fresh initial `state` JSON for a new game session. */
export function initState(gameType: GameType) {
  switch (gameType) {
    case "TIC_TAC_TOE":    return initTTT();
    case "CONNECT_FOUR":   return initC4();
    case "RPS":            return initRPS(3);
    case "DOTS_AND_BOXES": return initDnB(4, 4);
    case "BATTLESHIP":     return initBS();
    case "MEMORY":         return initMemory();
  }
}
