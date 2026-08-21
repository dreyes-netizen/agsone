import { SOLO_GAME_REGISTRY } from "@/lib/minigames/solo/registry";
import type { SoloGameType } from "@/lib/minigames/solo/types";

const SOLO_GAME_TYPES = Object.keys(SOLO_GAME_REGISTRY) as SoloGameType[];

export type SoloPersonalBestState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "absent" }
  | { status: "value"; score: number };

export type SoloPersonalBestStates = Record<SoloGameType, SoloPersonalBestState>;

type PersonalBestsResponse = {
  data: {
    personalBests: Record<SoloGameType, number | null>;
  };
};

type PersonalBestsFetcher = (url: string) => Promise<PersonalBestsResponse>;

export function createLoadingSoloPersonalBests(): SoloPersonalBestStates {
  return createStates(() => ({ status: "loading" }));
}

export async function loadSoloPersonalBests(fetcher: PersonalBestsFetcher): Promise<SoloPersonalBestStates> {
  try {
    const response = await fetcher("/api/minigames/solo/personal-bests");
    return createStates((gameType) => {
      const score = response.data.personalBests[gameType];
      return score === null ? { status: "absent" } : { status: "value", score };
    });
  } catch {
    return createStates(() => ({ status: "unavailable" }));
  }
}

function createStates(createState: (gameType: SoloGameType) => SoloPersonalBestState): SoloPersonalBestStates {
  return Object.fromEntries(SOLO_GAME_TYPES.map((gameType) => [gameType, createState(gameType)])) as SoloPersonalBestStates;
}
