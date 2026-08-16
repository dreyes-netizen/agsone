/**
 * Human-readable minigame names, with no UI dependencies.
 *
 * Split out of lib/constants/gameTypes.ts because that module imports
 * lucide-react for its icons, and API routes must not pull React components
 * into their bundle just to render "Connect Four" in a notification title.
 *
 * That bundle cost is why four separate routes each kept a private copy of this
 * map — and two of those copies were missing BATTLESHIP and MEMORY, so invite
 * and forfeit notifications for those games read "Minigame". One source fixes
 * it for good.
 */
export const GAME_LABELS = {
  RPS: "Rock Paper Scissors",
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship",
  MEMORY: "Memory",
} as const;

/**
 * `session.gameType` is a plain String column, not an enum, so lookups come
 * from unvalidated data. Falls back rather than rendering "undefined".
 */
export function gameLabel(gameType: string): string {
  return (GAME_LABELS as Record<string, string>)[gameType] ?? "Minigame";
}
