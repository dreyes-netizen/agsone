import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type { SoloGameType } from "@/lib/minigames/solo/types";
import type { SoloPersonalBestState, SoloPersonalBestStates } from "./soloPersonalBests";

export type SoloGameCard = {
  key: SoloGameType;
  label: string;
  scoreLabel: string;
  personalBest: string | null;
  href: string;
};

export function getSoloGameCards(personalBests: SoloPersonalBestStates): SoloGameCard[] {
  return Object.values(SOLO_GAME_REGISTRY).map((game) => {
    return {
      key: game.key,
      label: game.label,
      scoreLabel: game.scoreLabel,
      personalBest: formatPersonalBest(game.key, personalBests[game.key]),
      href: `/minigames/solo/${game.slug}`,
    };
  });
}

function formatPersonalBest(gameType: SoloGameType, personalBest: SoloPersonalBestState): string {
  if (personalBest.status === "loading") return "Loading official PB…";
  if (personalBest.status === "unavailable") return "Official PB unavailable";
  if (personalBest.status === "absent") return "No official PB yet";
  const { score } = personalBest;
  if (gameType === "TYPING") return `${score} WPM`;
  if (gameType === "REACTION") return `${score} ms`;
  return `Level ${score}`;
}
