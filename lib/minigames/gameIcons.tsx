import { Circle, Disc, Swords, Grid3x3, Ship, Brain, Gamepad2, type LucideIcon } from "lucide-react";

// Single source for the game-type -> icon mapping, replacing the emoji map
// that was independently duplicated in HowToPlayModal.tsx and
// minigames/stats/page.tsx (see AGSON-40/AGSON-37).
export const GAME_ICON: Record<string, LucideIcon> = {
  TIC_TAC_TOE: Circle,
  CONNECT_FOUR: Disc,
  RPS: Swords,
  DOTS_AND_BOXES: Grid3x3,
  BATTLESHIP: Ship,
  MEMORY: Brain,
};

export const DEFAULT_GAME_ICON = Gamepad2;
