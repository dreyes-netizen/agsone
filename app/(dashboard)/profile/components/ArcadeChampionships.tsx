import { Crown } from "lucide-react";
import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type { ArcadeChampionship } from "../types";

export function ArcadeChampionships({
  championships,
}: {
  championships: ArcadeChampionship[];
}) {
  return (
    <section className="bg-white rounded-card border border-table-border p-5" aria-labelledby="arcade-championships-heading">
      <h2 id="arcade-championships-heading" className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-500" aria-hidden="true" />
        Weekly arcade championships
      </h2>
      {championships.length === 0 ? (
        <p className="text-sm text-gray-500">Weekly arcade championships will appear here after your first win.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {championships.map((championship) => {
            const game = SOLO_GAME_REGISTRY[championship.gameType];
            const scopeLabel = championship.scope === "COMPANY" ? "Company" : "Department";
            const title = championship.scope === "COMPANY"
              ? "Company Champion"
              : `${championship.departmentNameSnapshot ?? "Department"} Department Champion`;

            return (
              <li key={championship.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {game?.label ?? championship.gameType} · {scopeLabel} scope
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  week of {formatWeek(championship.weekStart)} · {formatScore(championship)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatScore(championship: ArcadeChampionship) {
  if (championship.gameType === "TYPING") return `${championship.primaryScore} WPM`;
  if (championship.gameType === "REACTION") return `${championship.primaryScore} ms`;
  return `Level ${championship.primaryScore}`;
}

function formatWeek(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}
