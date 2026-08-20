export type SoloGameType =
  | "TYPING"
  | "REACTION"
  | "VISUAL_MEMORY"
  | "SEQUENCE_MEMORY";

export type SoloGameResult = {
  primaryScore: number;
  secondaryScore: number | null;
  isValid: boolean;
  validationReason: string | null;
  metrics: Record<string, string | number | boolean>;
};

export type SoloRankPeriod = "week" | "alltime";

export type SoloRankScope = "company" | "department";

export type SoloScoreDirection = "higher" | "lower";

export type SoloGameSlug =
  | "typing"
  | "reaction"
  | "visual-memory"
  | "sequence-memory";

export type SoloGameDefinition = {
  key: SoloGameType;
  slug: SoloGameSlug;
  label: string;
  scoreLabel: string;
  primaryDirection: SoloScoreDirection;
  secondaryDirection: SoloScoreDirection;
  rankedTtlMs: number;
  practiceCopy: string;
  rankedCopy: string;
};

export type ManilaRankKeys = {
  rankDate: string;
  weekStart: string;
};
