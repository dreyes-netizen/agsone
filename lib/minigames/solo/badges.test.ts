import { describe, expect, it } from "vitest";
import {
  ARCADE_BADGES,
  createSoloAchievementBadgeService,
  type SoloBadgeRepository,
} from "./badges";
import type { SoloGameType } from "./types";

class InMemoryBadgeRepository implements SoloBadgeRepository {
  readonly badges = ARCADE_BADGES.map((badge, index) => ({ id: `badge-${index + 1}`, name: badge.name }));
  readonly awards = new Set<string>();

  constructor(private readonly validGameTypes: SoloGameType[] = []) {}

  async findBadgesByName(names: readonly string[]) {
    return this.badges.filter((badge) => names.includes(badge.name));
  }

  async findValidGameTypes() {
    return this.validGameTypes;
  }

  async createAwards(userId: string, badgeIds: readonly string[]) {
    let count = 0;
    for (const badgeId of badgeIds) {
      const key = `${userId}:${badgeId}`;
      if (this.awards.has(key)) continue;
      this.awards.add(key);
      count += 1;
    }
    return count;
  }

  awardedNames(userId = "user-1") {
    return this.badges
      .filter((badge) => this.awards.has(`${userId}:${badge.id}`))
      .map((badge) => badge.name)
      .sort();
  }
}

describe("solo achievement badges", () => {
  it("awards each typing threshold at its inclusive WPM and 95% accuracy boundary", async () => {
    const repository = new InMemoryBadgeRepository();
    const award = createSoloAchievementBadgeService(repository).awardSoloAchievementBadges;

    await award("user-1", { gameType: "TYPING", isValid: true, primaryScore: 50, secondaryScore: 9_500 });
    await award("user-2", { gameType: "TYPING", isValid: true, primaryScore: 80, secondaryScore: 9_500 });
    await award("user-3", { gameType: "TYPING", isValid: true, primaryScore: 100, secondaryScore: 9_500 });
    await award("user-4", { gameType: "TYPING", isValid: true, primaryScore: 100, secondaryScore: 9_499 });

    expect(repository.awardedNames("user-1")).toEqual(["Arcade Debut", "Typing 50"]);
    expect(repository.awardedNames("user-2")).toEqual(["Arcade Debut", "Typing 50", "Typing 80"]);
    expect(repository.awardedNames("user-3")).toEqual(["Arcade Debut", "Typing 100", "Typing 50", "Typing 80"]);
    expect(repository.awardedNames("user-4")).toEqual(["Arcade Debut"]);
  });

  it("awards reaction and memory threshold badges at their inclusive score boundaries", async () => {
    const repository = new InMemoryBadgeRepository();
    const award = createSoloAchievementBadgeService(repository).awardSoloAchievementBadges;

    await award("reaction", { gameType: "REACTION", isValid: true, primaryScore: 200, secondaryScore: 1_000 });
    await award("visual", { gameType: "VISUAL_MEMORY", isValid: true, primaryScore: 8, secondaryScore: 1_000 });
    await award("sequence", { gameType: "SEQUENCE_MEMORY", isValid: true, primaryScore: 10, secondaryScore: 1_000 });

    expect(repository.awardedNames("reaction")).toEqual(["Arcade Debut", "Fast Reflexes", "Lightning Reflexes", "Quick Reflexes"]);
    expect(repository.awardedNames("visual")).toEqual(["Arcade Debut", "Visual Memory 5", "Visual Memory 8"]);
    expect(repository.awardedNames("sequence")).toEqual(["Arcade Debut", "Sequence 10", "Sequence 5", "Sequence 8"]);
  });

  it("awards Arcade All-Rounder only when the valid-completion query includes all four games", async () => {
    const completeRepository = new InMemoryBadgeRepository(["TYPING", "REACTION", "VISUAL_MEMORY", "SEQUENCE_MEMORY"]);
    const incompleteRepository = new InMemoryBadgeRepository(["TYPING", "REACTION", "VISUAL_MEMORY"]);

    await createSoloAchievementBadgeService(completeRepository).awardSoloAchievementBadges(
      "complete",
      { gameType: "SEQUENCE_MEMORY", isValid: true, primaryScore: 1, secondaryScore: 100 },
    );
    await createSoloAchievementBadgeService(incompleteRepository).awardSoloAchievementBadges(
      "incomplete",
      { gameType: "SEQUENCE_MEMORY", isValid: true, primaryScore: 1, secondaryScore: 100 },
    );

    expect(completeRepository.awardedNames("complete")).toEqual(["Arcade All-Rounder", "Arcade Debut"]);
    expect(incompleteRepository.awardedNames("incomplete")).toEqual(["Arcade Debut"]);
  });

  it("does not award invalid ranked completions and safely ignores duplicate award writes", async () => {
    const repository = new InMemoryBadgeRepository();
    const award = createSoloAchievementBadgeService(repository).awardSoloAchievementBadges;
    const invalid = { gameType: "REACTION" as const, isValid: false, primaryScore: 200, secondaryScore: 1_000 };
    const valid = { ...invalid, isValid: true };

    await award("user-1", invalid);
    await award("user-1", valid);
    await award("user-1", valid);

    expect(repository.awardedNames()).toEqual(["Arcade Debut", "Fast Reflexes", "Lightning Reflexes", "Quick Reflexes"]);
  });
});
