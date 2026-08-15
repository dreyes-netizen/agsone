import { describe, it, expect } from "vitest";
import { filterAndSortRewards, type RewardFilters } from "./filterRewards";
import type { Reward } from "../types";

function makeReward(overrides: Partial<Reward>): Reward {
  return {
    id: overrides.id ?? "id",
    name: "Reward",
    description: null,
    imageUrls: [],
    pointCost: 100,
    stockQuantity: -1,
    category: "PHYSICAL",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseFilters: RewardFilters = {
  category: "ALL",
  search: "",
  sort: "recommended",
  availableOnly: false,
  affordableOnly: false,
  balance: 1000,
};

describe("filterAndSortRewards", () => {
  const rewards = [
    makeReward({ id: "aqua", name: "AquaFlask 18oz", description: "Insulated bottle", category: "PHYSICAL", pointCost: 800, createdAt: "2026-01-03T00:00:00.000Z" }),
    makeReward({ id: "gift", name: "Starbucks Gift Card", description: "Coffee on us", category: "VOUCHER", pointCost: 250, createdAt: "2026-01-05T00:00:00.000Z" }),
    makeReward({ id: "wfh", name: "Work From Home Day", category: "PRIVILEGE", pointCost: 500, stockQuantity: 0, createdAt: "2026-01-01T00:00:00.000Z" }),
  ];

  it("filters by category", () => {
    const result = filterAndSortRewards(rewards, { ...baseFilters, category: "VOUCHER" });
    expect(result.map((r) => r.id)).toEqual(["gift"]);
  });

  it("matches search against name, description, and category", () => {
    expect(filterAndSortRewards(rewards, { ...baseFilters, search: "coffee" }).map((r) => r.id)).toEqual(["gift"]);
    expect(filterAndSortRewards(rewards, { ...baseFilters, search: "privilege" }).map((r) => r.id)).toEqual(["wfh"]);
    expect(filterAndSortRewards(rewards, { ...baseFilters, search: "nonexistent" })).toEqual([]);
  });

  it("excludes out-of-stock rewards when availableOnly is set", () => {
    const result = filterAndSortRewards(rewards, { ...baseFilters, availableOnly: true });
    expect(result.map((r) => r.id)).not.toContain("wfh");
  });

  it("excludes unaffordable rewards when affordableOnly is set", () => {
    const result = filterAndSortRewards(rewards, { ...baseFilters, affordableOnly: true, balance: 300 });
    expect(result.map((r) => r.id)).toEqual(["gift"]);
  });

  it("sorts by lowest and highest points (out-of-stock still sinks to the bottom)", () => {
    expect(filterAndSortRewards(rewards, { ...baseFilters, sort: "lowest" }).map((r) => r.id)).toEqual(["gift", "aqua", "wfh"]);
    expect(filterAndSortRewards(rewards, { ...baseFilters, sort: "highest" }).map((r) => r.id)).toEqual(["aqua", "gift", "wfh"]);
  });

  it("sorts by newest first", () => {
    expect(filterAndSortRewards(rewards, { ...baseFilters, sort: "newest" }).map((r) => r.id)).toEqual(["gift", "aqua", "wfh"]);
  });

  it("sorts by most redeemed using the real redemption count", () => {
    const withCounts = [
      makeReward({ id: "a", _count: { redemptions: 2 } }),
      makeReward({ id: "b", _count: { redemptions: 9 } }),
      makeReward({ id: "c" }),
    ];
    expect(filterAndSortRewards(withCounts, { ...baseFilters, sort: "mostRedeemed" }).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("always sinks out-of-stock rewards to the bottom regardless of sort", () => {
    const result = filterAndSortRewards(rewards, { ...baseFilters, sort: "lowest" });
    expect(result.at(-1)?.id).toBe("wfh");
  });
});
