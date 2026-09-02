// Standard competition ("1224") ranking: items tied on `points` share the
// same rank, and the next distinct score skips ahead accordingly (1, 1, 3
// rather than 1, 2, 3). Used by the leaderboard so a bulk award that gives
// several people the same points doesn't produce a misleading lone #1.
// Callers must pass items already sorted descending by `points`.
export function withCompetitionRank<T extends { points: number }>(
  items: T[]
): (T & { rank: number })[] {
  let rank = 0;
  let prevPoints: number | null = null;
  return items.map((item, i) => {
    if (prevPoints === null || item.points !== prevPoints) {
      rank = i + 1;
      prevPoints = item.points;
    }
    return { ...item, rank };
  });
}
