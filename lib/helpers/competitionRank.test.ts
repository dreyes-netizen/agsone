import { describe, it, expect } from "vitest";
import { withCompetitionRank } from "./competitionRank";

function ranks(points: number[]): number[] {
  return withCompetitionRank(points.map((p) => ({ points: p }))).map((e) => e.rank);
}

describe("withCompetitionRank", () => {
  it("returns no ranks for an empty list", () => {
    expect(ranks([])).toEqual([]);
  });

  it("ranks a single item #1", () => {
    expect(ranks([50])).toEqual([1]);
  });

  it("assigns sequential ranks when no one ties", () => {
    expect(ranks([100, 80, 60])).toEqual([1, 2, 3]);
  });

  it("shares a rank for a tie at the top and skips ahead for the next distinct score", () => {
    expect(ranks([50, 50, 30])).toEqual([1, 1, 3]);
  });

  it("shares a rank for a tie in the middle", () => {
    expect(ranks([90, 50, 50, 10])).toEqual([1, 2, 2, 4]);
  });

  it("gives everyone rank 1 when all items tie", () => {
    expect(ranks([50, 50, 50])).toEqual([1, 1, 1]);
  });
});
