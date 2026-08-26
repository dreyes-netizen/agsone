import { describe, expect, it } from "vitest";
import {
  toHeadToHeadRecord,
  toMultiplayerRecord,
  winRateOf,
} from "./playerRecord";

describe("winRateOf", () => {
  it("excludes draws from the denominator", () => {
    // 3 wins, 1 loss, however many draws → 75%, not 3/(3+1+draws).
    expect(winRateOf(3, 1)).toBe(75);
  });

  it("reports 0 rather than NaN when no game has been decided", () => {
    expect(winRateOf(0, 0)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    expect(winRateOf(1, 2)).toBe(33);
    expect(winRateOf(2, 1)).toBe(67);
  });
});

describe("toMultiplayerRecord", () => {
  it("coerces Postgres bigint counts and totals them across games", () => {
    // BigInt(...) rather than `8n` literals — the project's tsconfig target
    // predates ES2020 bigint literal syntax.
    const record = toMultiplayerRecord([
      { gameType: "CHESS", w: BigInt(8), l: BigInt(2), d: BigInt(0) },
      { gameType: "CONNECT_FOUR", w: BigInt(6), l: BigInt(3), d: BigInt(1) },
    ]);

    expect(record.perGame).toEqual({
      CHESS: { w: 8, l: 2, d: 0 },
      CONNECT_FOUR: { w: 6, l: 3, d: 1 },
    });
    expect(record).toMatchObject({ wins: 14, losses: 5, draws: 1, total: 20 });
    // 14 / (14 + 5) = 73.68…%, draws excluded.
    expect(record.winRate).toBe(74);
  });

  it("accepts plain numbers as well as bigints", () => {
    const record = toMultiplayerRecord([{ gameType: "MEMORY", w: 1, l: 1, d: 0 }]);
    expect(record).toMatchObject({ wins: 1, losses: 1, total: 2, winRate: 50 });
  });

  it("returns an empty, zeroed record for a player who has never finished a game", () => {
    expect(toMultiplayerRecord([])).toEqual({
      wins: 0,
      losses: 0,
      draws: 0,
      total: 0,
      winRate: 0,
      perGame: {},
    });
  });
});

describe("toHeadToHeadRecord", () => {
  it("maps the single aggregate row", () => {
    expect(
      toHeadToHeadRecord([{ wins: BigInt(2), losses: BigInt(1), draws: BigInt(3) }]),
    ).toEqual({
      wins: 2,
      losses: 1,
      draws: 3,
      total: 6,
    });
  });

  it("treats an empty result as a clean slate", () => {
    expect(toHeadToHeadRecord([])).toEqual({
      wins: 0,
      losses: 0,
      draws: 0,
      total: 0,
    });
  });
});
