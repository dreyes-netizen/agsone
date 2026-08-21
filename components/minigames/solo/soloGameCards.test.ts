import { describe, expect, it } from "vitest";
import { getSoloGameCards } from "./soloGameCards";

describe("getSoloGameCards", () => {
  it("builds every playable solo game card with its score unit, route, and truthful PB state", () => {
    expect(getSoloGameCards({
      TYPING: { status: "loading" },
      REACTION: { status: "unavailable" },
      VISUAL_MEMORY: { status: "absent" },
      SEQUENCE_MEMORY: { status: "value", score: 9 },
    })).toEqual([
      {
        key: "TYPING",
        label: "Typing Sprint",
        scoreLabel: "WPM",
        personalBest: "Loading official PB…",
        href: "/minigames/solo/typing",
      },
      {
        key: "REACTION",
        label: "Reaction Rush",
        scoreLabel: "Avg. reaction time",
        personalBest: "Official PB unavailable",
        href: "/minigames/solo/reaction",
      },
      {
        key: "VISUAL_MEMORY",
        label: "Visual Memory",
        scoreLabel: "Level",
        personalBest: "No official PB yet",
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

  it("formats each loaded score in its game's official unit", () => {
    expect(getSoloGameCards({
      TYPING: { status: "value", score: 72 },
      REACTION: { status: "value", score: 248 },
      VISUAL_MEMORY: { status: "value", score: 6 },
      SEQUENCE_MEMORY: { status: "value", score: 9 },
    }).map((card) => card.personalBest)).toEqual([
      "72 WPM",
      "248 ms",
      "Level 6",
      "Level 9",
    ]);
  });
});
