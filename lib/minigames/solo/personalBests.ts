import { prisma } from "@/lib/prisma/client";
import { SOLO_GAME_REGISTRY } from "./registry";
import type { SoloGameType } from "./types";

const SOLO_GAME_TYPES = Object.keys(SOLO_GAME_REGISTRY) as SoloGameType[];

type SoloPersonalBestAggregate = {
  gameType: string;
  _max: { primaryScore: number | null };
  _min: { primaryScore: number | null };
};

type SoloPersonalBestQuery = {
  getAggregates: (userId: string) => Promise<SoloPersonalBestAggregate[]>;
};

export type SoloPersonalBests = Record<SoloGameType, number | null>;

export function buildSoloPersonalBestQuery(userId: string) {
  return {
    by: ["gameType"] as ["gameType"],
    where: {
      userId,
      gameType: { in: SOLO_GAME_TYPES },
      status: "COMPLETED" as const,
      isValid: true as const,
      primaryScore: { not: null },
    },
    _max: {
      primaryScore: true as const,
    },
    _min: {
      primaryScore: true as const,
    },
  };
}

export function createSoloPersonalBestService({ getAggregates }: SoloPersonalBestQuery) {
  async function getSoloPersonalBests(userId: string): Promise<SoloPersonalBests> {
    const aggregates = await getAggregates(userId);
    const scores: Partial<Record<SoloGameType, number | null>> = {};

    for (const aggregate of aggregates) {
      if (!(aggregate.gameType in SOLO_GAME_REGISTRY)) continue;
      const gameType = aggregate.gameType as SoloGameType;
      scores[gameType] = SOLO_GAME_REGISTRY[gameType].primaryDirection === "higher"
        ? aggregate._max.primaryScore
        : aggregate._min.primaryScore;
    }

    return Object.fromEntries(SOLO_GAME_TYPES.map((gameType) => [gameType, scores[gameType] ?? null])) as SoloPersonalBests;
  }

  return { getSoloPersonalBests };
}

const prismaPersonalBestQuery: SoloPersonalBestQuery = {
  async getAggregates(userId) {
    const query = buildSoloPersonalBestQuery(userId);
    const aggregates = await prisma.soloGameAttempt.groupBy({
      by: ["gameType"],
      where: query.where,
      _max: { primaryScore: true },
      _min: { primaryScore: true },
    });
    return aggregates;
  },
};

const defaultService = createSoloPersonalBestService(prismaPersonalBestQuery);

export const getSoloPersonalBests = defaultService.getSoloPersonalBests;
