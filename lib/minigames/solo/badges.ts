import { prisma } from "@/lib/prisma/client";
import type { SoloGameResult, SoloGameType } from "./types";

export const ARCADE_BADGES = [
  { name: "Arcade Debut", description: "Complete your first valid ranked solo attempt." },
  { name: "Arcade All-Rounder", description: "Complete a valid ranked attempt in every Solo Arcade game." },
  { name: "Typing 50", description: "Reach 50 WPM with at least 95% accuracy in Typing Sprint." },
  { name: "Typing 80", description: "Reach 80 WPM with at least 95% accuracy in Typing Sprint." },
  { name: "Typing 100", description: "Reach 100 WPM with at least 95% accuracy in Typing Sprint." },
  { name: "Quick Reflexes", description: "Finish Reaction Rush with a 300 ms average reaction time or faster." },
  { name: "Fast Reflexes", description: "Finish Reaction Rush with a 250 ms average reaction time or faster." },
  { name: "Lightning Reflexes", description: "Finish Reaction Rush with a 200 ms average reaction time or faster." },
  { name: "Visual Memory 5", description: "Complete level 5 in Visual Memory." },
  { name: "Visual Memory 8", description: "Complete level 8 in Visual Memory." },
  { name: "Visual Memory 10", description: "Complete level 10 in Visual Memory." },
  { name: "Sequence 5", description: "Complete level 5 in Sequence Memory." },
  { name: "Sequence 8", description: "Complete level 8 in Sequence Memory." },
  { name: "Sequence 10", description: "Complete level 10 in Sequence Memory." },
] as const;

type ArcadeBadgeName = (typeof ARCADE_BADGES)[number]["name"];

export type SoloBadgeAttemptResult = Pick<
  SoloGameResult,
  "isValid" | "primaryScore" | "secondaryScore"
> & {
  gameType: SoloGameType;
};

export interface SoloBadgeRepository {
  findBadgesByName(names: readonly string[]): Promise<Array<{ id: string; name: string }>>;
  findValidGameTypes(userId: string): Promise<SoloGameType[]>;
  createAwards(userId: string, badgeIds: readonly string[]): Promise<number>;
}

export function createSoloAchievementBadgeService(repository: SoloBadgeRepository) {
  async function awardSoloAchievementBadges(userId: string, attemptResult: SoloBadgeAttemptResult) {
    if (!attemptResult.isValid) return;

    const eligible = eligibleBadgeNames(attemptResult);
    const validGameTypes = await repository.findValidGameTypes(userId);
    if (hasCompletedEveryGame(validGameTypes)) eligible.push("Arcade All-Rounder");

    const badges = await repository.findBadgesByName(eligible);
    await repository.createAwards(userId, badges.map((badge) => badge.id));
  }

  return { awardSoloAchievementBadges };
}

function eligibleBadgeNames(attemptResult: SoloBadgeAttemptResult): ArcadeBadgeName[] {
  const eligible: ArcadeBadgeName[] = ["Arcade Debut"];
  const { gameType, primaryScore, secondaryScore } = attemptResult;

  switch (gameType) {
    case "TYPING":
      if ((secondaryScore ?? 0) < 9_500) return eligible;
      if (primaryScore >= 50) eligible.push("Typing 50");
      if (primaryScore >= 80) eligible.push("Typing 80");
      if (primaryScore >= 100) eligible.push("Typing 100");
      return eligible;
    case "REACTION":
      if (primaryScore <= 300) eligible.push("Quick Reflexes");
      if (primaryScore <= 250) eligible.push("Fast Reflexes");
      if (primaryScore <= 200) eligible.push("Lightning Reflexes");
      return eligible;
    case "VISUAL_MEMORY":
      if (primaryScore >= 5) eligible.push("Visual Memory 5");
      if (primaryScore >= 8) eligible.push("Visual Memory 8");
      if (primaryScore >= 10) eligible.push("Visual Memory 10");
      return eligible;
    case "SEQUENCE_MEMORY":
      if (primaryScore >= 5) eligible.push("Sequence 5");
      if (primaryScore >= 8) eligible.push("Sequence 8");
      if (primaryScore >= 10) eligible.push("Sequence 10");
      return eligible;
  }
}

function hasCompletedEveryGame(gameTypes: SoloGameType[]) {
  const completedGames = new Set(gameTypes);
  return ["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"].every((gameType) => completedGames.has(gameType as SoloGameType));
}

const prismaRepository: SoloBadgeRepository = {
  async findBadgesByName(names) {
    return prisma.badge.findMany({
      where: { name: { in: [...names] } },
      select: { id: true, name: true },
    });
  },
  async findValidGameTypes(userId) {
    const attempts = await prisma.soloGameAttempt.findMany({
      where: { userId, status: "COMPLETED", isValid: true },
      distinct: ["gameType"],
      select: { gameType: true },
    });
    return attempts.map((attempt) => attempt.gameType as SoloGameType);
  },
  async createAwards(userId, badgeIds) {
    if (badgeIds.length === 0) return 0;
    const result = await prisma.userBadge.createMany({
      data: badgeIds.map((badgeId) => ({ userId, badgeId })),
      skipDuplicates: true,
    });
    return result.count;
  },
};

const defaultService = createSoloAchievementBadgeService(prismaRepository);

export const awardSoloAchievementBadges = defaultService.awardSoloAchievementBadges;
