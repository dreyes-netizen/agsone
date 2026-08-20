import type { SoloGameDefinition, SoloGameType } from "./types";

const RANKED_TTL_MS = 15 * 60 * 1000;

export const SOLO_GAME_REGISTRY: Record<SoloGameType, SoloGameDefinition> = {
  TYPING: {
    key: "TYPING",
    slug: "typing",
    label: "Typing Sprint",
    scoreLabel: "WPM",
    primaryDirection: "higher",
    secondaryDirection: "higher",
    rankedTtlMs: RANKED_TTL_MS,
    practiceCopy: "Unlimited browser-only runs with local feedback and no leaderboard impact.",
    rankedCopy: "Three daily Manila-ranked starts. The server validates your 60-second passage result and only scores runs at 95% accuracy or higher.",
  },
  REACTION: {
    key: "REACTION",
    slug: "reaction",
    label: "Reaction Rush",
    scoreLabel: "Avg. reaction time",
    primaryDirection: "lower",
    secondaryDirection: "lower",
    rankedTtlMs: RANKED_TTL_MS,
    practiceCopy: "Unlimited browser-only runs with no attempt consumption or leaderboard impact.",
    rankedCopy: "Three daily Manila-ranked starts. Five seeded trials are scored by the server, and false starts cost 1000 ms for that trial.",
  },
  VISUAL_MEMORY: {
    key: "VISUAL_MEMORY",
    slug: "visual-memory",
    label: "Visual Memory",
    scoreLabel: "Level",
    primaryDirection: "higher",
    secondaryDirection: "lower",
    rankedTtlMs: RANKED_TTL_MS,
    practiceCopy: "Unlimited browser-only runs with local progress tracking and no leaderboard impact.",
    rankedCopy: "Three daily Manila-ranked starts. The server rebuilds each seeded board and scores your best completed level, then elapsed time.",
  },
  SEQUENCE_MEMORY: {
    key: "SEQUENCE_MEMORY",
    slug: "sequence-memory",
    label: "Sequence Memory",
    scoreLabel: "Level",
    primaryDirection: "higher",
    secondaryDirection: "lower",
    rankedTtlMs: RANKED_TTL_MS,
    practiceCopy: "Unlimited browser-only runs with local progress tracking and no leaderboard impact.",
    rankedCopy: "Three daily Manila-ranked starts. The server rebuilds the seeded sequence and scores your best completed level, then elapsed time.",
  },
};
