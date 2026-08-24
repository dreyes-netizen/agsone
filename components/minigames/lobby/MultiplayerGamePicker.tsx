"use client";

import { GAME_TYPES, type GameTypeKey } from "@/lib/constants/gameTypes";

type Props = {
  selected: GameTypeKey;
  onSelect: (game: GameTypeKey) => void;
};

// Responsive card grid replacing the old horizontally-scrolling tab strip —
// selecting a card updates the composer in place, it never navigates.
export function MultiplayerGamePicker({ selected, onSelect }: Props) {
  return (
    <div
      role="group"
      aria-label="Choose a multiplayer game"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2"
    >
      {GAME_TYPES.map((game) => (
        <button
          key={game.key}
          type="button"
          aria-pressed={selected === game.key}
          onClick={() => onSelect(game.key)}
          className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 ${
            selected === game.key
              ? "bg-command-black border-command-black text-white"
              : "bg-white border-table-border text-gray-700 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <game.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{game.label}</span>
          {game.badge && (
            <span
              className={`ml-auto shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                selected === game.key
                  ? "bg-white/20 text-white"
                  : "bg-navy-100 text-navy-700"
              }`}
            >
              {game.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
