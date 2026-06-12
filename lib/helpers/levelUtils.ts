// Pure level calculation helpers — no server imports, safe for client components

const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1750];
const LEVEL_6_BASE = 2750;
const LEVEL_6_STEP = 1000;

export function getLevelFromBalance(balance: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (balance >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelProgress(balance: number): { pointsIntoLevel: number; pointsNeededForLevel: number } {
  const level = getLevelFromBalance(balance);
  const currentThreshold = level <= LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[level - 1]
    : LEVEL_6_BASE + (level - 6) * LEVEL_6_STEP;
  const nextThreshold = level < LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[level]
    : LEVEL_6_BASE + (level - 5) * LEVEL_6_STEP;
  return {
    pointsIntoLevel: balance - currentThreshold,
    pointsNeededForLevel: nextThreshold - currentThreshold,
  };
}
