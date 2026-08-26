import { Medal, Trophy } from "lucide-react";

/**
 * Rank marker shared by every leaderboard: a trophy for 1st, medals for 2nd and
 * 3rd, and a plain number below that. Each variant carries its own `aria-label`
 * because the icon alone conveys the rank visually.
 */
export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div
        className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0"
        aria-label="Rank 1"
      >
        <Trophy className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
      </div>
    );
  if (rank === 2)
    return (
      <div
        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
        aria-label="Rank 2"
      >
        <Medal className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
      </div>
    );
  if (rank === 3)
    return (
      <div
        className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0"
        aria-label="Rank 3"
      >
        <Medal className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
      </div>
    );
  return (
    <span
      className="w-7 text-center text-xs font-semibold text-gray-500 shrink-0"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}
