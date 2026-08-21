import { Hand, Circle, CircleDot, Grid3x3, Ship, Brain, Crown, type LucideIcon } from "lucide-react";

export type GameTypeKey =
  | "RPS"
  | "TIC_TAC_TOE"
  | "CONNECT_FOUR"
  | "DOTS_AND_BOXES"
  | "BATTLESHIP"
  | "MEMORY"
  | "CHESS";

export type GameTypeEntry = {
  key: GameTypeKey;
  label: string;
  short: string;
  desc: string;
  icon: LucideIcon;
  badge?: string;
};

export const GAME_TYPES: GameTypeEntry[] = [
  { key: "RPS",             label: "Rock Paper Scissors", short: "RPS", desc: "3 rounds · Simultaneous picks · Quick & fun",  icon: Hand },
  { key: "TIC_TAC_TOE",     label: "Tic-Tac-Toe",         short: "TTT", desc: "3×3 grid · Get 3 in a row to win",             icon: Circle },
  { key: "CONNECT_FOUR",    label: "Connect Four",        short: "C4",  desc: "7×6 grid · First to 4-in-a-row wins",         icon: CircleDot },
  { key: "DOTS_AND_BOXES",  label: "Dots & Boxes",        short: "D&B", desc: "4×4 grid · Claim the most boxes",             icon: Grid3x3 },
  { key: "BATTLESHIP",      label: "Battleship",          short: "BS",  desc: "8×8 grid · Sink all enemy ships to win",      icon: Ship },
  { key: "MEMORY",          label: "Memory",              short: "Mem", desc: "4×4 grid · Match all emoji pairs to win",     icon: Brain },
  {
    key: "CHESS",
    label: "Chess",
    short: "Chess",
    desc: "Classic chess · 5 or 10 min",
    icon: Crown,
    badge: "New",
  },
];

// Indexed as Record<string, ...> (not GameTypeKey) so lookups from API-sourced
// strings (e.g. `session.gameType`) don't require a cast at every call site.
export const GAME_TYPE_ICONS: Record<string, LucideIcon> = GAME_TYPES.reduce(
  (acc, g) => ({ ...acc, [g.key]: g.icon }),
  {} as Record<string, LucideIcon>,
);

export const GAME_TYPE_LABELS: Record<string, string> = GAME_TYPES.reduce(
  (acc, g) => ({ ...acc, [g.key]: g.label }),
  {} as Record<string, string>,
);
