import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  applyChessMove,
  declineChessDraw,
  deriveChessOutcome,
  getChessClock,
  getChessTimeoutOutcome,
  initChess,
  isChessUntimed,
  offerChessDraw,
  rehydrateChess,
  startChessClock,
  type ChessMoveInput,
  type ChessRole,
  type ChessState,
} from "./chess";
import { initState } from "./initState";

const T0 = "2026-08-22T00:00:00.000Z";

function at(secondsFromStart: number): Date {
  return new Date(Date.parse(T0) + secondsFromStart * 1000);
}

function freshStarted(timeControlMinutes: 5 | 10 = 5): ChessState {
  return startChessClock(initChess({ timeControlMinutes }), new Date(T0));
}

/**
 * Replays a verified-legal from/to sequence through the real domain function,
 * one second of thinking time per half-move. Host (White) plays the even
 * indexes, guest (Black) the odd ones — so every move goes through chess.js's
 * own legality checker rather than being asserted independently of it.
 */
function playSequence(
  moves: ChessMoveInput[],
  state: ChessState = freshStarted(),
) {
  let current = state;
  let last = null as ReturnType<typeof applyChessMove> | null;

  moves.forEach((move, index) => {
    const role: ChessRole = index % 2 === 0 ? "host" : "guest";
    last = applyChessMove(current, move, role, at(index + 1));
    current = last.state;
  });

  if (!last) throw new Error("playSequence requires at least one move");
  return last;
}

// --- Verified legal sequences (see task-3 report for provenance) ------------

/** 1. f3 e5 2. g4 Qh4# — Fool's mate, Black (guest) delivers checkmate. */
const FOOLS_MATE: ChessMoveInput[] = [
  { from: "f2", to: "f3" },
  { from: "e7", to: "e5" },
  { from: "g2", to: "g4" },
  { from: "d8", to: "h4" },
];

/**
 * Sam Loyd's 10-move stalemate:
 * 1. e3 a5 2. Qh5 Ra6 3. Qxa5 h5 4. Qxc7 Rah6 5. h4 f6
 * 6. Qxd7+ Kf7 7. Qxb7 Qd3 8. Qxb8 Qh7 9. Qxc8 Kg6 10. Qe6 ½-½
 */
const LOYD_STALEMATE: ChessMoveInput[] = [
  { from: "e2", to: "e3" },
  { from: "a7", to: "a5" },
  { from: "d1", to: "h5" },
  { from: "a8", to: "a6" },
  { from: "h5", to: "a5" },
  { from: "h7", to: "h5" },
  { from: "a5", to: "c7" },
  { from: "a6", to: "h6" },
  { from: "h2", to: "h4" },
  { from: "f7", to: "f6" },
  { from: "c7", to: "d7" },
  { from: "e8", to: "f7" },
  { from: "d7", to: "b7" },
  { from: "d8", to: "d3" },
  { from: "b7", to: "b8" },
  { from: "d3", to: "h7" },
  { from: "b8", to: "c8" },
  { from: "f7", to: "g6" },
  { from: "c8", to: "e6" },
];

/** 1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 — start position seen 3x. */
const THREEFOLD: ChessMoveInput[] = [
  { from: "g1", to: "f3" },
  { from: "g8", to: "f6" },
  { from: "f3", to: "g1" },
  { from: "f6", to: "g8" },
  { from: "g1", to: "f3" },
  { from: "g8", to: "f6" },
  { from: "f3", to: "g1" },
  { from: "f6", to: "g8" },
];

/**
 * Pawn race to a White promotion on h8:
 * 1. h4 a5 2. h5 a4 3. h6 a3 4. hxg7 axb2 5. gxh8=?
 * The 9th half-move is the promotion and is appended per test.
 */
const PROMOTION_PRELUDE: ChessMoveInput[] = [
  { from: "h2", to: "h4" },
  { from: "a7", to: "a5" },
  { from: "h4", to: "h5" },
  { from: "a5", to: "a4" },
  { from: "h5", to: "h6" },
  { from: "a4", to: "a3" },
  { from: "h6", to: "g7" },
  { from: "a3", to: "b2" },
];

// --- Regression: initState two-arg contract ---------------------------------
// The create session route (app/api/minigames/sessions/route.ts) calls
// initState(gameType, settings) with the validated settings. For CHESS this
// must be forwarded to asChessSettings, which requires a valid
// timeControlMinutes. Omitting settings (the pre-fix, single-arg call) used
// to fall through to the default `= {}` and throw an uncaught zod error.

describe("initState CHESS contract", () => {
  it("builds a valid initial ChessState when settings are provided", () => {
    const state = initState("CHESS", { timeControlMinutes: 5 }) as ChessState;

    expect(state.whiteMs).toBe(300_000);
    expect(state.turnStartedAt).toBeNull();
  });

  it("throws when settings are omitted (the bug this task fixed)", () => {
    expect(() => initState("CHESS")).toThrow();
  });
});

// --- Step 1: initial state and clock ---------------------------------------

describe("chess state", () => {
  it("initializes a 5-minute game without running the clock", () => {
    const state = initChess({ timeControlMinutes: 5 });

    expect(state.whiteMs).toBe(300_000);
    expect(state.blackMs).toBe(300_000);
    expect(state.turnStartedAt).toBeNull();
    expect(state.moves).toEqual([]);
    expect(state.drawOfferBy).toBeNull();
    expect(state.endReason).toBeNull();
  });

  it("initializes a 10-minute game with a 10-minute bank per side", () => {
    const state = initChess({ timeControlMinutes: 10 });

    expect(state.whiteMs).toBe(600_000);
    expect(state.blackMs).toBe(600_000);
    expect(state.timeControlMinutes).toBe(10);
    expect(state.fen).toBe(new Chess().fen());
  });

  it("starts White's clock only when the game activates", () => {
    const created = initChess({ timeControlMinutes: 5 });
    const started = startChessClock(created, new Date(T0));

    expect(started.turnStartedAt).toBe("2026-08-22T00:00:00.000Z");
    expect(started.whiteMs).toBe(300_000);
    // pure: the input snapshot is untouched
    expect(created.turnStartedAt).toBeNull();
  });

  it("does not restart an already-running clock", () => {
    const started = freshStarted();
    const again = startChessClock(started, at(30));

    expect(again.turnStartedAt).toBe("2026-08-22T00:00:00.000Z");
  });

  it("computes elapsed active-side time without mutating the snapshot", () => {
    const state = freshStarted();

    expect(getChessClock(state, at(3.5))).toMatchObject({
      whiteMs: 296_500,
      blackMs: 300_000,
    });
    expect(state.whiteMs).toBe(300_000);
  });

  it("reports no elapsed time before the clock starts", () => {
    const state = initChess({ timeControlMinutes: 5 });

    expect(getChessClock(state, at(120))).toEqual({
      whiteMs: 300_000,
      blackMs: 300_000,
      expiredRole: null,
    });
  });
});

// --- Free time: the no-limit game (timeControlMinutes: 0) ------------------
// Agents (and slow human players) were running out of time on the 5/10-minute
// controls mid-game. `0` opts a session out of the clock entirely rather than
// tuning the bank size — nobody times out, ever.

describe("chess untimed games", () => {
  it("initializes with a zero bank and is reported as untimed", () => {
    const state = initChess({ timeControlMinutes: 0 });

    expect(state.whiteMs).toBe(0);
    expect(state.blackMs).toBe(0);
    expect(isChessUntimed(state)).toBe(true);
  });

  it("never starts the clock when the session activates", () => {
    const created = initChess({ timeControlMinutes: 0 });
    const started = startChessClock(created, new Date(T0));

    expect(started.turnStartedAt).toBeNull();
  });

  it("never restarts the clock as moves are played", () => {
    const started = startChessClock(initChess({ timeControlMinutes: 0 }), new Date(T0));
    const afterWhite = applyChessMove(started, { from: "e2", to: "e4" }, "host", at(500));
    const afterBlack = applyChessMove(afterWhite.state, { from: "e7", to: "e5" }, "guest", at(1000));

    expect(afterWhite.state.turnStartedAt).toBeNull();
    expect(afterBlack.state.turnStartedAt).toBeNull();
    expect(afterBlack.state.whiteMs).toBe(0);
    expect(afterBlack.state.blackMs).toBe(0);
  });

  it("never reports an expired clock, no matter how much wall time passes", () => {
    const started = startChessClock(initChess({ timeControlMinutes: 0 }), new Date(T0));

    expect(getChessClock(started, at(999_999))).toEqual({
      whiteMs: 0,
      blackMs: 0,
      expiredRole: null,
    });
    expect(getChessTimeoutOutcome(started, at(999_999))).toBeNull();
  });

  it("never rejects a move for a stale clock", () => {
    const started = startChessClock(initChess({ timeControlMinutes: 0 }), new Date(T0));

    expect(() =>
      applyChessMove(started, { from: "e2", to: "e4" }, "host", at(999_999)),
    ).not.toThrow();
  });
});

// --- Step 2: move legality and turn ordering -------------------------------

describe("chess moves", () => {
  it("applies a legal White move and starts Black's clock", () => {
    const started = freshStarted();

    const result = applyChessMove(started, { from: "e2", to: "e4" }, "host", at(2));

    expect(result.outcome).toEqual({ status: "ongoing" });
    expect(result.state.whiteMs).toBe(298_000);
    expect(result.state.blackMs).toBe(300_000);
    expect(result.state.moves).toHaveLength(1);
    expect(result.state.moves[0]).toMatchObject({ from: "e2", to: "e4", san: "e4" });
    expect(result.state.turnStartedAt).toBe("2026-08-22T00:00:02.000Z");
    expect(result.state.lastMove).toMatchObject({ from: "e2", to: "e4" });
    // input snapshot untouched
    expect(started.moves).toHaveLength(0);
  });

  it("charges each side only for its own thinking time", () => {
    const started = freshStarted();
    const white = applyChessMove(started, { from: "e2", to: "e4" }, "host", at(2));
    const black = applyChessMove(white.state, { from: "e7", to: "e5" }, "guest", at(7));

    expect(black.state.whiteMs).toBe(298_000);
    expect(black.state.blackMs).toBe(295_000);
    expect(getChessClock(black.state, at(9))).toMatchObject({
      whiteMs: 296_000,
      blackMs: 295_000,
      expiredRole: null,
    });
  });

  it("rejects an illegal move", () => {
    const started = freshStarted();

    expect(() =>
      applyChessMove(started, { from: "e2", to: "e5" }, "host", at(1)),
    ).toThrow("Illegal move");
  });

  it("rejects a move from an empty square", () => {
    const started = freshStarted();

    expect(() =>
      applyChessMove(started, { from: "e4", to: "e5" }, "host", at(1)),
    ).toThrow("Illegal move");
  });

  it("rejects Black trying to move on White's turn", () => {
    const started = freshStarted();

    expect(() =>
      applyChessMove(started, { from: "e7", to: "e5" }, "guest", at(1)),
    ).toThrow("Not your turn");
  });

  it("rejects any move once the game has ended", () => {
    const mate = playSequence(FOOLS_MATE);

    expect(() =>
      applyChessMove(mate.state, { from: "e1", to: "f2" }, "host", at(30)),
    ).toThrow("Game already finished");
  });

  it("clears a pending draw offer when a move is played", () => {
    const started = { ...freshStarted(), drawOfferBy: "guest" as ChessRole };
    const result = applyChessMove(started, { from: "e2", to: "e4" }, "host", at(1));

    expect(result.state.drawOfferBy).toBeNull();
  });
});

// --- Step 3: promotion and terminal results --------------------------------

describe("chess terminal results", () => {
  it("detects checkmate and records checkmate reason", () => {
    const result = playSequence(FOOLS_MATE);

    expect(result.outcome).toEqual({
      status: "win",
      winner: "guest",
      reason: "checkmate",
    });
    expect(result.state.endReason).toBe("checkmate");
    expect(result.state.winner).toBe("guest");
    expect(result.state.turnStartedAt).toBeNull();
    expect(result.state.moves.at(-1)?.san).toBe("Qh4#");
  });

  it("detects stalemate as a draw", () => {
    const result = playSequence(LOYD_STALEMATE);

    expect(result.outcome).toEqual({ status: "draw", reason: "stalemate" });
    expect(result.state.endReason).toBe("stalemate");
    expect(result.state.winner).toBeNull();
  });

  it("preserves move history so repetition can be detected", () => {
    const result = playSequence(THREEFOLD);

    expect(result.state.moves).toHaveLength(8);
    expect(result.outcome).toEqual({ status: "draw", reason: "threefold" });
    expect(result.state.endReason).toBe("threefold");
    // the repeated position is the starting position
    expect(result.state.fen.split(" ")[0]).toBe(new Chess().fen().split(" ")[0]);
  });

  it.each([
    ["q", "gxh8=Q"],
    ["r", "gxh8=R"],
    ["b", "gxh8=B"],
    ["n", "gxh8=N"],
  ] as const)("supports explicit %s promotion", (promotion, san) => {
    const prelude = playSequence(PROMOTION_PRELUDE);
    const result = applyChessMove(
      prelude.state,
      { from: "g7", to: "h8", promotion },
      "host",
      at(20),
    );

    expect(result.state.moves).toHaveLength(9);
    expect(result.state.moves.at(-1)).toMatchObject({
      from: "g7",
      to: "h8",
      promotion,
      san,
    });
    expect(result.state.lastMove).toMatchObject({ from: "g7", to: "h8", promotion });
    // the persisted history must replay back to the persisted FEN
    expect(rehydrateChess(result.state).fen()).toBe(result.state.fen);
  });

  it("derives fifty-move and insufficient-material draws from a real position", () => {
    const fiftyMove = new Chess("8/8/8/4k3/8/8/4K3/4R3 w - - 100 60");
    expect(fiftyMove.isDrawByFiftyMoves()).toBe(true);
    expect(deriveChessOutcome(fiftyMove, "host")).toEqual({
      status: "draw",
      reason: "fifty_move",
    });

    const bareKings = new Chess("8/8/8/4k3/8/8/4K3/8 w - - 0 1");
    expect(bareKings.isInsufficientMaterial()).toBe(true);
    expect(deriveChessOutcome(bareKings, "host")).toEqual({
      status: "draw",
      reason: "insufficient_material",
    });

    const kingAndKnight = new Chess("8/8/8/4k3/8/8/4K3/6N1 w - - 0 1");
    expect(deriveChessOutcome(kingAndKnight, "guest")).toEqual({
      status: "draw",
      reason: "insufficient_material",
    });
  });

  it("reports an ongoing game as ongoing", () => {
    expect(deriveChessOutcome(new Chess(), "host")).toEqual({ status: "ongoing" });
  });
});

// --- rehydration -----------------------------------------------------------

describe("rehydrateChess", () => {
  it("replays the stored move list back to the stored FEN and PGN", () => {
    const result = playSequence(THREEFOLD.slice(0, 4));
    const game = rehydrateChess(result.state);

    expect(game.fen()).toBe(result.state.fen);
    expect(game.history()).toEqual(["Nf3", "Nf6", "Ng1", "Ng8"]);
  });

  it("keeps repetition history that a FEN-only reload would lose", () => {
    const result = playSequence(THREEFOLD);

    expect(rehydrateChess(result.state).isThreefoldRepetition()).toBe(true);
    // proof that reconstructing from FEN alone would NOT detect it
    expect(new Chess(result.state.fen).isThreefoldRepetition()).toBe(false);
  });

  it("throws when the stored FEN does not match the replayed move list", () => {
    const result = playSequence([{ from: "e2", to: "e4" }]);
    const tampered: ChessState = {
      ...result.state,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    };

    expect(() => rehydrateChess(tampered)).toThrow("Chess state is inconsistent");
  });

  it("throws when the stored move list itself is not replayable", () => {
    const result = playSequence([{ from: "e2", to: "e4" }]);
    const tampered: ChessState = {
      ...result.state,
      moves: [{ from: "e2", to: "e5", san: "e5" }],
    };

    expect(() => rehydrateChess(tampered)).toThrow("Chess state is inconsistent");
  });
});

// --- Step 4: timeouts ------------------------------------------------------

describe("chess clock expiry", () => {
  it("reports White expired when White's active clock reaches zero", () => {
    const started = freshStarted();

    expect(getChessClock(started, new Date("2026-08-22T00:05:00.001Z"))).toMatchObject({
      whiteMs: 0,
      expiredRole: "host",
    });
  });

  it("reports Black expired when Black is on move and out of time", () => {
    const started = freshStarted();
    const afterWhite = applyChessMove(started, { from: "e2", to: "e4" }, "host", at(2));

    expect(getChessClock(afterWhite.state, at(2 + 301))).toMatchObject({
      whiteMs: 298_000,
      blackMs: 0,
      expiredRole: "guest",
    });
  });

  it("freezes the clock once the game has ended", () => {
    const mate = playSequence(FOOLS_MATE);

    expect(getChessClock(mate.state, at(9999))).toMatchObject({
      whiteMs: mate.state.whiteMs,
      blackMs: mate.state.blackMs,
      expiredRole: null,
    });
  });

  it("rejects a move received after the mover's server clock expired", () => {
    const started = freshStarted();

    expect(() =>
      applyChessMove(
        started,
        { from: "e2", to: "e4" },
        "host",
        new Date("2026-08-22T00:05:00.001Z"),
      ),
    ).toThrow("Clock expired");
  });
});

// --- Step 7: timeout settlement --------------------------------------------

describe("getChessTimeoutOutcome", () => {
  it("maps an expired White clock to a guest win", () => {
    const started = freshStarted();

    expect(
      getChessTimeoutOutcome(started, new Date("2026-08-22T00:05:00.001Z")),
    ).toMatchObject({ winner: "guest", expired: "host" });
  });

  it("maps an expired Black clock to a host win", () => {
    const afterWhite = applyChessMove(
      freshStarted(),
      { from: "e2", to: "e4" },
      "host",
      at(2),
    );

    expect(getChessTimeoutOutcome(afterWhite.state, at(2 + 301))).toMatchObject({
      winner: "host",
      expired: "guest",
    });
  });

  it("returns null when neither clock expired", () => {
    expect(getChessTimeoutOutcome(freshStarted(), at(10))).toBeNull();
  });

  it("returns null on a game that has already ended", () => {
    // The move route already froze the clock on checkmate, so a late timeout
    // claim must not be able to re-decide a finished game.
    const mate = playSequence(FOOLS_MATE);

    expect(getChessTimeoutOutcome(mate.state, at(9999))).toBeNull();
  });

  it("returns null before the clock has been started", () => {
    expect(getChessTimeoutOutcome(initChess({ timeControlMinutes: 5 }), at(9999))).toBeNull();
  });

  /**
   * These two are what the timeout route persists as the final clock: the
   * expired side must read exactly 0 and the winner must keep the time they
   * had banked, so neither keeps counting down after settlement.
   */
  it("carries the frozen clock for the settling route to persist", () => {
    const started = freshStarted();

    expect(getChessTimeoutOutcome(started, new Date("2026-08-22T00:05:00.001Z"))).toEqual({
      winner: "guest",
      expired: "host",
      whiteMs: 0,
      blackMs: 300_000,
    });
  });

  it("leaves the waiting side's bank untouched when the mover flags", () => {
    // White spends 2s, then Black sits until Black's own bank runs out: White
    // must be frozen at the 298s they had left, not at zero.
    const afterWhite = applyChessMove(
      freshStarted(),
      { from: "e2", to: "e4" },
      "host",
      at(2),
    );

    expect(getChessTimeoutOutcome(afterWhite.state, at(2 + 301))).toEqual({
      winner: "host",
      expired: "guest",
      whiteMs: 298_000,
      blackMs: 0,
    });
  });
});

// --- Step 6: draw offers ---------------------------------------------------

describe("chess draw offers", () => {
  it("records a draw offer from a participant", () => {
    const offered = offerChessDraw(freshStarted(), "host");

    expect(offered.drawOfferBy).toBe("host");
  });

  it("leaves the rest of the position untouched when an offer is recorded", () => {
    const started = freshStarted();
    const offered = offerChessDraw(started, "guest");

    expect(offered).toEqual({ ...started, drawOfferBy: "guest" });
    // Pure: the caller's snapshot must not be mutated in place.
    expect(started.drawOfferBy).toBeNull();
  });

  it("re-offering replaces the outstanding offer rather than stacking a second one", () => {
    const offered = offerChessDraw(offerChessDraw(freshStarted(), "host"), "guest");

    expect(offered.drawOfferBy).toBe("guest");
  });

  it("refuses to record a draw offer on a finished game", () => {
    const mate = playSequence(FOOLS_MATE);

    expect(() => offerChessDraw(mate.state, "host")).toThrow("Game already finished");
  });

  it("does not allow accepting your own draw offer", () => {
    // Acceptance settles the database row and the wager, so the route owns it
    // (see the 400 case in the draw route's own test). The symmetric rule the
    // domain does own is that you cannot answer your own offer at all:
    // declining it yourself would silently retract a pending offer the
    // opponent may already be responding to.
    const offered = offerChessDraw(freshStarted(), "host");

    expect(() => declineChessDraw(offered, "host")).toThrow(
      "Cannot decline your own draw offer",
    );
  });

  it("clears the offer when the opponent declines", () => {
    const offered = offerChessDraw(freshStarted(), "host");
    const declined = declineChessDraw(offered, "guest");

    expect(declined.drawOfferBy).toBeNull();
  });

  it("throws when declining with nothing outstanding", () => {
    expect(() => declineChessDraw(freshStarted(), "guest")).toThrow("No draw offer");
  });

  it("clears a pending draw offer after a legal move", () => {
    const offered = offerChessDraw(freshStarted(), "guest");
    const moved = applyChessMove(offered, { from: "e2", to: "e4" }, "host", at(1));

    expect(moved.state.drawOfferBy).toBeNull();
  });
});
