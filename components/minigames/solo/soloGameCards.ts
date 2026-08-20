import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type { SoloGameType } from "@/lib/minigames/solo/types";

export type SoloGameCard = {
  key: SoloGameType;
  label: string;
  scoreLabel: string;
  personalBest: string | null;
  href: string;
};

export function getSoloGameCards(personalBests: Partial<Record<SoloGameType, number>>): SoloGameCard[] {
  return Object.values(SOLO_GAME_REGISTRY).map((game) => {
    const score = personalBests[game.key];
    return {
      key: game.key,
      label: game.label,
      scoreLabel: game.scoreLabel,
      personalBest: score === undefined ? null : formatPersonalBest(game.key, score),
      href: `/minigames/solo/${game.slug}`,
    };
  });
}

function formatPersonalBest(gameType: SoloGameType, score: number): string {
  if (gameType === "TYPING") return `${score} WPM`;
  if (gameType === "REACTION") return `${score} ms`;
  return `Level ${score}`;
}
