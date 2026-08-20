import { describe, expect, it } from "vitest";
import { getSoloGameCards } from "./soloGameCards";

describe("getSoloGameCards", () => {
  it("builds every playable solo game card with its score unit, official PB, and route", () => {
    expect(getSoloGameCards({
      TYPING: 72,
      REACTION: 248,
      VISUAL_MEMORY: 6,
      SEQUENCE_MEMORY: 9,
    })).toEqual([
      {
        key: "TYPING",
        label: "Typing Sprint",
        scoreLabel: "WPM",
        personalBest: "72 WPM",
        href: "/minigames/solo/typing",
      },
      {
        key: "REACTION",
        label: "Reaction Rush",
        scoreLabel: "Avg. reaction time",
        personalBest: "248 ms",
        href: "/minigames/solo/reaction",
      },
      {
        key: "VISUAL_MEMORY",
        label: "Visual Memory",
        scoreLabel: "Level",
        personalBest: "Level 6",
        href: "/minigames/solo/visual-memory",
      },
      {
        key: "SEQUENCE_MEMORY",
        label: "Sequence Memory",
        scoreLabel: "Level",
        personalBest: "Level 9",
        href: "/minigames/solo/sequence-memory",
      },
    ]);
  });

  it("does not invent a personal best when no official result exists", () => {
    expect(getSoloGameCards({}).map((card) => card.personalBest)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});
