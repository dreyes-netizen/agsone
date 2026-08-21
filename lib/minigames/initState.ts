import { initTTT } from "./tictactoe";
import { initC4 } from "./connectfour";
import { initRPS } from "./rps";
import { initDnB } from "./dotsandboxes";
import { initBS } from "./battleship";
import { initMemory } from "./memory";
import { initChess } from "./chess";
import { asChessSettings } from "./gameSettings";

export const GAME_TYPES = [
  "TIC_TAC_TOE",
  "CONNECT_FOUR",
  "RPS",
  "DOTS_AND_BOXES",
  "BATTLESHIP",
  "MEMORY",
  "CHESS",
] as const;

export type GameType = (typeof GAME_TYPES)[number];

/**
 * Build the fresh initial `state` JSON for a new game session.
 *
 * `settings` is the validated per-session config (currently only Chess uses
 * it, for its time control). It is optional so every existing single-argument
 * caller keeps working unchanged.
 */
export function initState(
  gameType: GameType,
  settings: Record<string, unknown> = {},
) {
  switch (gameType) {
    case "TIC_TAC_TOE":    return initTTT();
    case "CONNECT_FOUR":   return initC4();
    case "RPS":            return initRPS(3);
    case "DOTS_AND_BOXES": return initDnB(4, 4);
    case "BATTLESHIP":     return initBS();
    case "MEMORY":         return initMemory();
    case "CHESS":          return initChess(asChessSettings(settings));
  }
}
