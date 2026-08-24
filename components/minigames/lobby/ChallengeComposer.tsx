"use client";

import { GAME_TYPES, GAME_TYPE_LABELS, type GameTypeKey } from "@/lib/constants/gameTypes";

const WAGER_OPTIONS = [0, 10, 25, 50];
const GAME_LABEL = GAME_TYPE_LABELS;

type Props = {
  gameType: GameTypeKey;
  wager: number;
  onWagerChange: (wager: number) => void;
  chessTimeControl: 5 | 10;
  onChessTimeControlChange: (minutes: 5 | 10) => void;
  creating: boolean;
  onCreate: () => void;
  onShowHelp: () => void;
};

export function ChallengeComposer({
  gameType,
  wager,
  onWagerChange,
  chessTimeControl,
  onChessTimeControlChange,
  creating,
  onCreate,
  onShowHelp,
}: Props) {
  const game = GAME_TYPES.find((g) => g.key === gameType);

  return (
    <div className="bg-white border border-table-border rounded-card p-4 space-y-4">
      {game && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-navy-50 border border-navy-100">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-navy-900 flex items-center gap-1.5">
              <game.icon className="w-4 h-4" aria-hidden="true" />
              {game.label}
            </p>
            <p className="text-xs text-navy-600 mt-0.5">{game.desc}</p>
          </div>
          <button
            onClick={onShowHelp}
            className="shrink-0 text-xs text-navy-500 hover:text-navy-700 font-semibold underline underline-offset-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded"
          >
            How to play
          </button>
        </div>
      )}

      {gameType === "CHESS" && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2" id="time-control-label">Time control</p>
          <div className="flex gap-2" role="group" aria-labelledby="time-control-label">
            {([5, 10] as const).map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={chessTimeControl === minutes}
                onClick={() => onChessTimeControlChange(minutes)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 ${
                  chessTimeControl === minutes
                    ? "bg-command-black border-command-black text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2" id="wager-label">Points wager</p>
        <div className="flex gap-2" role="group" aria-labelledby="wager-label">
          {WAGER_OPTIONS.map(w => (
            <button
              key={w}
              aria-pressed={wager === w}
              onClick={() => onWagerChange(w)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 ${
                wager === w
                  ? "bg-command-black border-command-black text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {w === 0 ? "Free" : `${w} pts`}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onCreate}
        disabled={creating}
        className="w-full py-2.5 bg-command-black hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
      >
        {creating ? "Creating…" : `Create ${GAME_LABEL[gameType]} Challenge`}
      </button>
    </div>
  );
}
