"use client";

import { CheckCircle2, Trophy } from "lucide-react";
import type { SoloGameDefinition, SoloGameResult } from "@/lib/minigames/solo/types";
import type { SoloGameMode } from "./types";

type Props = {
  game: SoloGameDefinition;
  mode: SoloGameMode;
  result: SoloGameResult | null;
  isPersonalBest?: boolean;
  onPlayAgain: () => void;
};

export function SoloResultPanel({ game, mode, result, isPersonalBest = false, onPlayAgain }: Props) {
  const isOfficial = mode === "ranked";
  const score = result ? `${result.primaryScore} ${game.scoreLabel}` : null;

  return (
    <section aria-live="polite" className="bg-white border border-table-border rounded-card p-5 text-center space-y-3">
      <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
        {isPersonalBest ? <Trophy className="w-5 h-5" aria-hidden="true" /> : <CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{isOfficial ? "Official result" : "Practice complete"}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {isOfficial ? "Your server-validated ranked result is shown below." : "Practice runs stay on this device and never affect rankings."}
        </p>
      </div>
      {score && <p className="text-2xl font-black text-navy-800">{score}</p>}
      {isOfficial && result && !result.isValid && <p className="text-sm text-amber-700">This attempt was not eligible for rankings: {result.validationReason?.replaceAll("_", " ").toLowerCase()}.</p>}
      {isPersonalBest && <p className="text-sm font-semibold text-emerald-700">New ranked personal best</p>}
      <button onClick={onPlayAgain} className="px-4 py-2 rounded-lg bg-command-black text-white text-sm font-bold hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
        Play again
      </button>
    </section>
  );
}
