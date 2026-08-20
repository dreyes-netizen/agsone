"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { apiFetch } from "@/lib/hooks/useApiClient";
import type { SoloGameType } from "@/lib/minigames/solo/types";
import { getSoloGameCards } from "./soloGameCards";

type SummaryResponse = {
  data: {
    personalBest: { primaryScore: number } | null;
  };
};

const SOLO_GAME_TYPES: SoloGameType[] = ["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"];

export function SoloGameGrid() {
  const [personalBests, setPersonalBests] = useState<Partial<Record<SoloGameType, number>>>({});

  useEffect(() => {
    let active = true;

    async function loadPersonalBests() {
      const summaries = await Promise.all(
        SOLO_GAME_TYPES.map(async (gameType) => {
          try {
            const response = await apiFetch<SummaryResponse>(`/api/minigames/solo/summary?gameType=${gameType}`);
            return [gameType, response.data.personalBest?.primaryScore] as const;
          } catch {
            return [gameType, undefined] as const;
          }
        }),
      );

      if (!active) return;
      setPersonalBests(Object.fromEntries(summaries.filter(([, score]) => score !== undefined)));
    }

    void loadPersonalBests();
    return () => { active = false; };
  }, []);

  const cards = getSoloGameCards(personalBests);

  return (
    <section aria-labelledby="solo-games-heading" className="space-y-3">
      <div>
        <h2 id="solo-games-heading" className="text-lg font-bold text-gray-900">Solo Games</h2>
        <p className="mt-0.5 text-sm text-gray-500">Practice anytime or set an official personal best in a ranked run.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((game) => (
          <Link
            key={game.key}
            href={game.href}
            aria-label={`Play ${game.label}`}
            className="group rounded-xl border border-table-border bg-white p-4 transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-600"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{game.label}</h3>
                <p className="mt-1 text-xs text-gray-500">Score: {game.scoreLabel}</p>
              </div>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-gray-400 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <p className="flex items-center gap-1.5 text-xs text-gray-600">
                <Trophy className="size-3.5 text-amber-600" aria-hidden="true" />
                <span>Official PB: <strong className="font-semibold text-gray-800">{game.personalBest ?? "No score yet"}</strong></span>
              </p>
              <span className="text-xs font-semibold text-navy-700 group-hover:text-navy-800">Play</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
