import { describe, it, expect } from "vitest";
import { initMemory, applyMemoryMove, checkMemoryResult, maskMemoryState, type MemoryState } from "./memory";

describe("memory game logic", () => {
  it("initMemory produces 16 cards as 8 matching pairs", () => {
    const state = initMemory();
    expect(state.cards).toHaveLength(16);
    const byPair = new Map<number, number>();
    for (const c of state.cards) byPair.set(c.pairId, (byPair.get(c.pairId) ?? 0) + 1);
    expect([...byPair.values()]).toEqual(Array(8).fill(2));
  });

  it("first flip of a turn just sets flipped, keeps turn", () => {
    const state = initMemory();
    const { state: next, keepTurn } = applyMemoryMove(state, { cardIndex: 0 }, true);
    expect(next.flipped).toBe(0);
    expect(keepTurn).toBe(true);
  });

  it("matching second flip scores the mover and grants an extra turn", () => {
    const state = initMemory();
    const pairIndex = state.cards.findIndex((c, i) => state.cards.some((c2, j) => j !== i && c2.pairId === c.pairId));
    const otherIndex = state.cards.findIndex((c, i) => i !== pairIndex && c.pairId === state.cards[pairIndex].pairId);

    const afterFirst = applyMemoryMove(state, { cardIndex: pairIndex }, true).state;
    const { state: afterSecond, keepTurn } = applyMemoryMove(afterFirst, { cardIndex: otherIndex }, true);

    expect(afterSecond.matched).toContain(pairIndex);
    expect(afterSecond.matched).toContain(otherIndex);
    expect(afterSecond.hostScore).toBe(1);
    expect(afterSecond.guestScore).toBe(0);
    expect(keepTurn).toBe(true);
  });

  it("non-matching second flip reveals both and waits for confirm", () => {
    const state = initMemory();
    const first = 0;
    const second = state.cards.findIndex((c, i) => i !== first && c.pairId !== state.cards[first].pairId);

    const afterFirst = applyMemoryMove(state, { cardIndex: first }, true).state;
    const { state: afterSecond } = applyMemoryMove(afterFirst, { cardIndex: second }, true);

    expect(afterSecond.revealed).toEqual([first, second]);
    expect(afterSecond.matched).toHaveLength(0);
  });

  it("confirm on a no-match reveal flips both back and ends the turn", () => {
    const state = initMemory();
    const first = 0;
    const second = state.cards.findIndex((c, i) => i !== first && c.pairId !== state.cards[first].pairId);
    const revealed = applyMemoryMove(applyMemoryMove(state, { cardIndex: first }, true).state, { cardIndex: second }, true).state;

    const { state: confirmed, keepTurn } = applyMemoryMove(revealed, { confirm: true }, true);
    expect(confirmed.revealed).toBeNull();
    expect(confirmed.flipped).toBeNull();
    expect(keepTurn).toBe(false);
  });

  it("rejects flipping an already-matched or already-flipped card", () => {
    const state = initMemory();
    const afterFirst = applyMemoryMove(state, { cardIndex: 0 }, true).state;
    expect(() => applyMemoryMove(afterFirst, { cardIndex: 0 }, true)).toThrow("Already flipped");
  });

  it("checkMemoryResult is null until every card is matched, then picks the higher score", () => {
    const base: MemoryState = {
      cards: [{ emoji: "a", pairId: 0 }, { emoji: "a", pairId: 0 }],
      matched: [],
      flipped: null,
      revealed: null,
      revealedIsMatch: false,
      hostScore: 0,
      guestScore: 0,
    };
    expect(checkMemoryResult(base)).toBeNull();
    expect(checkMemoryResult({ ...base, matched: [0, 1], hostScore: 2, guestScore: 1 })).toBe("host");
    expect(checkMemoryResult({ ...base, matched: [0, 1], hostScore: 1, guestScore: 1 })).toBe("draw");
  });

  describe("maskMemoryState (AGSON-44)", () => {
    it("redacts every card that is not matched, flipped, or revealed", () => {
      const state = initMemory();
      const masked = maskMemoryState(state, true);
      for (let i = 0; i < masked.cards.length; i++) {
        expect(masked.cards[i]).toEqual({ emoji: "", pairId: -1 });
      }
    });

    it("passes through matched cards unmasked", () => {
      const state = initMemory();
      const withMatch = { ...state, matched: [0, 1] };
      const masked = maskMemoryState(withMatch, true);
      expect(masked.cards[0]).toEqual(state.cards[0]);
      expect(masked.cards[1]).toEqual(state.cards[1]);
      expect(masked.cards[2]).toEqual({ emoji: "", pairId: -1 });
    });

    it("passes through the currently flipped card unmasked", () => {
      const state = initMemory();
      const withFlip = { ...state, flipped: 3 };
      const masked = maskMemoryState(withFlip, true);
      expect(masked.cards[3]).toEqual(state.cards[3]);
    });

    it("passes through both revealed (pending-confirm) cards unmasked", () => {
      const state = initMemory();
      const withReveal = { ...state, revealed: [4, 7] as [number, number] };
      const masked = maskMemoryState(withReveal, true);
      expect(masked.cards[4]).toEqual(state.cards[4]);
      expect(masked.cards[7]).toEqual(state.cards[7]);
    });

    it("masking is identical for host and guest viewers (board is symmetric)", () => {
      const state = initMemory();
      const maskedHost = maskMemoryState(state, true);
      const maskedGuest = maskMemoryState(state, false);
      expect(maskedHost).toEqual(maskedGuest);
    });

    it("does not mutate the input state", () => {
      const state = initMemory();
      const original = JSON.parse(JSON.stringify(state));
      maskMemoryState(state, true);
      expect(state).toEqual(original);
    });
  });
});
