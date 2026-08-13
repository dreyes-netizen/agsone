import { describe, it, expect } from "vitest";
import { getReactionSummary, getVisibleReactionTabs } from "./reactionSummary";

describe("getReactionSummary", () => {
  it("returns zero total and no emojis when there are no reactions", () => {
    expect(getReactionSummary({})).toEqual({ total: 0, topEmojis: [] });
  });

  it("sums counts across all reaction types for the total", () => {
    const { total } = getReactionSummary({ "👍": 10, "❤️": 6, "👏": 5, "🎉": 3 });
    expect(total).toBe(24);
  });

  it("orders top emojis by count, descending", () => {
    const { topEmojis } = getReactionSummary({ "👍": 1, "❤️": 10, "👏": 5 });
    expect(topEmojis).toEqual(["❤️", "👏", "👍"]);
  });

  it("caps top emojis at 3 even with more reaction types present", () => {
    const { topEmojis } = getReactionSummary({ "👍": 1, "❤️": 2, "👏": 3, "🎉": 4, "💪": 5, "🔥": 6 });
    expect(topEmojis).toHaveLength(3);
    expect(topEmojis).toEqual(["🔥", "💪", "🎉"]);
  });

  it("handles a single reaction type", () => {
    expect(getReactionSummary({ "🔥": 1 })).toEqual({ total: 1, topEmojis: ["🔥"] });
  });
});

describe("getVisibleReactionTabs", () => {
  it("hides reaction types with a zero or missing count", () => {
    const tabs = getVisibleReactionTabs({ "👍": 10, "❤️": 0, "👏": 5 });
    expect(tabs.map((t) => t.emoji)).toEqual(["👍", "👏"]);
  });

  it("returns an empty list when there are no reactions", () => {
    expect(getVisibleReactionTabs({})).toEqual([]);
  });

  it("preserves the app's fixed emoji display order, not insertion/count order", () => {
    // REACTIONS order is 👍 ❤️ 🔥 👏 🎉 💪 — counts given out of order here
    const tabs = getVisibleReactionTabs({ "🎉": 1, "👍": 1, "🔥": 1 });
    expect(tabs.map((t) => t.emoji)).toEqual(["👍", "🔥", "🎉"]);
  });
});
