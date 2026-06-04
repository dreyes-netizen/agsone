const EMOJIS = ["🐶", "🐱", "🦊", "🐸", "🦋", "🌸", "🍎", "🎸"];

export type MemoryCard = { emoji: string; pairId: number };

export type MemoryState = {
  cards: MemoryCard[];
  matched: number[];
  flipped: number | null;           // first card of current turn
  revealed: [number, number] | null; // both face-up awaiting confirm (no-match only)
  revealedIsMatch: boolean;
  hostScore: number;
  guestScore: number;
};

export function initMemory(): MemoryState {
  const cards: MemoryCard[] = [];
  EMOJIS.forEach((emoji, pairId) => {
    cards.push({ emoji, pairId });
    cards.push({ emoji, pairId });
  });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, matched: [], flipped: null, revealed: null, revealedIsMatch: false, hostScore: 0, guestScore: 0 };
}

export function applyMemoryMove(
  state: MemoryState,
  move: { cardIndex: number } | { confirm: true },
  isHost: boolean
): { state: MemoryState; keepTurn: boolean } {
  if ("confirm" in move) {
    if (!state.revealed) throw new Error("No pending reveal");
    // No-match: flip back, end turn
    return { state: { ...state, revealed: null, revealedIsMatch: false, flipped: null }, keepTurn: false };
  }

  const { cardIndex } = move;
  if (cardIndex < 0 || cardIndex >= state.cards.length) throw new Error("Invalid index");
  if (state.matched.includes(cardIndex)) throw new Error("Already matched");
  if (state.flipped === cardIndex) throw new Error("Already flipped");
  if (state.revealed !== null) throw new Error("Confirm current reveal first");

  // First flip of this turn
  if (state.flipped === null) {
    return { state: { ...state, flipped: cardIndex }, keepTurn: true };
  }

  // Second flip — check match
  const first = state.flipped;
  const isMatch = state.cards[first].pairId === state.cards[cardIndex].pairId;

  if (isMatch) {
    return {
      state: {
        ...state,
        matched: [...state.matched, first, cardIndex],
        flipped: null,
        revealed: null,
        revealedIsMatch: false,
        hostScore: isHost ? state.hostScore + 1 : state.hostScore,
        guestScore: !isHost ? state.guestScore + 1 : state.guestScore,
      },
      keepTurn: true, // matched → extra turn
    };
  }

  // No match: reveal both, wait for confirm
  return {
    state: { ...state, flipped: null, revealed: [first, cardIndex], revealedIsMatch: false },
    keepTurn: true, // still active player's turn until they confirm
  };
}

export function checkMemoryResult(state: MemoryState): "host" | "guest" | "draw" | null {
  if (state.matched.length < state.cards.length) return null;
  if (state.hostScore > state.guestScore) return "host";
  if (state.guestScore > state.hostScore) return "guest";
  return "draw";
}
