/**
 * Server-authoritative Chess domain.
 *
 * Everything in this module is a *pure* function: state in, new state out.
 * In particular no function here ever calls `Date.now()` — the caller passes
 * the clock in as a `Date`. That is what makes timeouts testable without
 * timers and keeps the API routes the only place that touches wall time.
 *
 * `chess.js` is the rules engine. The client never decides legality, whose
 * turn it is, how much time is left, or who won.
 */
import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { ChessSettings } from "./gameSettings";

export type ChessRole = "host" | "guest";

/** Host is always White and moves first; guest is always Black. */
export const WHITE_ROLE: ChessRole = "host";
export const BLACK_ROLE: ChessRole = "guest";

export type ChessPromotion = Extract<PieceSymbol, "q" | "r" | "b" | "n">;

export type ChessMoveInput = {
  from: string;
  to: string;
  promotion?: ChessPromotion;
};

/** A move as persisted in `GameSession.state` — replayable and displayable. */
export type ChessMoveRecord = ChessMoveInput & {
  /** Standard Algebraic Notation, e.g. "Qh4#". Display only. */
  san: string;
};

/**
 * Every way a chess game can end. The first five are detected automatically by
 * this module; the last three are set by the draw / timeout / forfeit routes.
 */
export type ChessEndReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fifty_move"
  | "insufficient_material"
  | "draw_agreement"
  | "timeout"
  | "forfeit";

export type ChessDrawReason = Extract<
  ChessEndReason,
  "stalemate" | "threefold" | "fifty_move" | "insufficient_material"
>;

export type ChessOutcome =
  | { status: "ongoing" }
  | { status: "win"; winner: ChessRole; reason: "checkmate" }
  | { status: "draw"; reason: ChessDrawReason };

export type ChessState = {
  timeControlMinutes: ChessSettings["timeControlMinutes"];
  /** Position after the last applied move. Always kept in sync with `moves`. */
  fen: string;
  pgn: string;
  moves: ChessMoveRecord[];
  lastMove: ChessMoveInput | null;
  /** Remaining bank for each side, excluding the time the mover is burning now. */
  whiteMs: number;
  blackMs: number;
  /**
   * ISO timestamp at which the side to move started thinking, or `null` when
   * the clock is not running (game not activated yet, or already over).
   * The active side's true remaining time is `bank - (now - turnStartedAt)`,
   * computed on read — we never write a ticking clock to the database.
   */
  turnStartedAt: string | null;
  drawOfferBy: ChessRole | null;
  endReason: ChessEndReason | null;
  winner: ChessRole | null;
};

export type ChessClock = {
  whiteMs: number;
  blackMs: number;
  /** The side whose bank has hit zero right now, if any. */
  expiredRole: ChessRole | null;
};

export type ChessMoveResult = {
  state: ChessState;
  outcome: ChessOutcome;
  move: ChessMoveRecord;
};

/** Fresh state for a new session. The clock deliberately does NOT start here. */
export function initChess(settings: ChessSettings): ChessState {
  const bankMs = settings.timeControlMinutes * 60_000;
  const game = new Chess();

  return {
    timeControlMinutes: settings.timeControlMinutes,
    fen: game.fen(),
    pgn: game.pgn(),
    moves: [],
    lastMove: null,
    whiteMs: bankMs,
    blackMs: bankMs,
    turnStartedAt: null,
    drawOfferBy: null,
    endReason: null,
    winner: null,
  };
}

/**
 * Starts White's clock. Called once, when the guest joins and the session goes
 * ACTIVE — never from `initChess`, because a session can sit in a lobby for
 * minutes before an opponent arrives. Idempotent.
 */
export function startChessClock(state: ChessState, now: Date): ChessState {
  if (state.turnStartedAt !== null || state.endReason !== null) return state;
  return { ...state, turnStartedAt: now.toISOString() };
}

/** Whose move it is, derived from the authoritative move history. */
export function activeChessRole(state: ChessState): ChessRole {
  return state.moves.length % 2 === 0 ? WHITE_ROLE : BLACK_ROLE;
}

/**
 * Reads both clocks at `now`. Pure: the stored snapshot is never mutated and
 * the elapsed time of the side on move is subtracted on the fly.
 */
export function getChessClock(state: ChessState, now: Date): ChessClock {
  const frozen: ChessClock = {
    whiteMs: state.whiteMs,
    blackMs: state.blackMs,
    expiredRole: null,
  };

  if (state.endReason !== null || state.turnStartedAt === null) return frozen;

  const startedAt = Date.parse(state.turnStartedAt);
  if (Number.isNaN(startedAt)) return frozen;

  // Clamp: a clock skew that puts `now` before the turn start must never
  // hand the mover extra time.
  const elapsedMs = Math.max(0, now.getTime() - startedAt);
  const active = activeChessRole(state);
  const bankMs = active === WHITE_ROLE ? state.whiteMs : state.blackMs;
  const remainingMs = Math.max(0, bankMs - elapsedMs);

  return {
    whiteMs: active === WHITE_ROLE ? remainingMs : state.whiteMs,
    blackMs: active === BLACK_ROLE ? remainingMs : state.blackMs,
    expiredRole: remainingMs <= 0 ? active : null,
  };
}

/**
 * Decides whether a clock has run out at `now`, and if so who that hands the
 * game to.
 *
 * The frozen `whiteMs`/`blackMs` come from the very same `getChessClock` read
 * that made the expiry decision, and are returned alongside the winner so the
 * settling route persists exactly the clock it judged — not a second reading
 * taken a few milliseconds later. Written into the final state (together with
 * `turnStartedAt: null`) they leave the flagged side showing 0 and the winner
 * showing the time they actually had banked.
 *
 * Returns `null` — meaning "do not settle" — for a game that has not started,
 * one already finished, or one where the side on move still has time.
 */
export function getChessTimeoutOutcome(
  state: ChessState,
  now: Date,
): { winner: ChessRole; expired: ChessRole; whiteMs: number; blackMs: number } | null {
  const clock = getChessClock(state, now);
  if (clock.expiredRole === null) return null;

  return {
    winner: clock.expiredRole === WHITE_ROLE ? BLACK_ROLE : WHITE_ROLE,
    expired: clock.expiredRole,
    whiteMs: clock.whiteMs,
    blackMs: clock.blackMs,
  };
}

/**
 * Rebuilds a `chess.js` instance by REPLAYING the persisted move list.
 *
 * Loading the FEN alone would be shorter but would silently lose the position
 * history, and `isThreefoldRepetition()` needs that history to work at all.
 * The FEN comparison at the end is a tamper/corruption tripwire: if the stored
 * position and the stored moves disagree, we refuse to act on either.
 */
export function rehydrateChess(state: ChessState): Chess {
  const game = new Chess();

  for (const move of state.moves) {
    try {
      game.move({
        from: move.from as Square,
        to: move.to as Square,
        promotion: move.promotion,
      });
    } catch {
      throw new Error("Chess state is inconsistent");
    }
  }

  if (game.fen() !== state.fen) {
    throw new Error("Chess state is inconsistent");
  }

  return game;
}

/**
 * Classifies a position. `actorRole` is whoever just moved — the only player
 * who can be the winner, since you cannot checkmate yourself.
 */
export function deriveChessOutcome(
  game: Chess,
  actorRole: ChessRole,
): ChessOutcome {
  if (game.isCheckmate()) {
    return { status: "win", winner: actorRole, reason: "checkmate" };
  }
  if (game.isStalemate()) {
    return { status: "draw", reason: "stalemate" };
  }
  if (game.isThreefoldRepetition()) {
    return { status: "draw", reason: "threefold" };
  }
  if (game.isDrawByFiftyMoves()) {
    return { status: "draw", reason: "fifty_move" };
  }
  if (game.isInsufficientMaterial()) {
    return { status: "draw", reason: "insufficient_material" };
  }
  return { status: "ongoing" };
}

/**
 * Records a draw offer from `role`.
 *
 * There is deliberately only ever *one* outstanding offer: re-offering (by
 * either side) replaces it rather than queueing a second one, so the accept
 * path never has to decide which of two offers it is answering.
 */
export function offerChessDraw(
  state: ChessState,
  role: ChessRole,
): ChessState {
  if (state.endReason) throw new Error("Game already finished");
  return { ...state, drawOfferBy: role };
}

/**
 * Clears an outstanding draw offer.
 *
 * You cannot decline your own offer — retracting is not a V1 action, and
 * allowing it would let a player yank the offer out from under an opponent who
 * is already accepting it. Accepting is NOT here: it finishes the game and
 * settles the wager, which only the route can do atomically against the row.
 */
export function declineChessDraw(
  state: ChessState,
  role: ChessRole,
): ChessState {
  if (!state.drawOfferBy) throw new Error("No draw offer");
  if (state.drawOfferBy === role) {
    throw new Error("Cannot decline your own draw offer");
  }
  return { ...state, drawOfferBy: null };
}

/**
 * Validates and applies one move. Throws on anything the mover is not allowed
 * to do — the caller maps these messages to 4xx responses.
 */
export function applyChessMove(
  state: ChessState,
  input: ChessMoveInput,
  role: ChessRole,
  now: Date,
): ChessMoveResult {
  if (state.endReason !== null) {
    throw new Error("Game already finished");
  }
  if (activeChessRole(state) !== role) {
    throw new Error("Not your turn");
  }

  const clock = getChessClock(state, now);
  if (clock.expiredRole !== null) {
    throw new Error("Clock expired");
  }

  const game = rehydrateChess(state);

  let move;
  try {
    move = game.move({
      from: input.from as Square,
      to: input.to as Square,
      promotion: input.promotion,
    });
  } catch {
    throw new Error("Illegal move");
  }

  const record: ChessMoveRecord = {
    from: move.from,
    to: move.to,
    ...(move.promotion
      ? { promotion: move.promotion as ChessPromotion }
      : {}),
    san: move.san,
  };

  const outcome = deriveChessOutcome(game, role);
  const endReason: ChessEndReason | null =
    outcome.status === "ongoing" ? null : outcome.reason;

  const nextState: ChessState = {
    ...state,
    fen: game.fen(),
    pgn: game.pgn(),
    moves: [...state.moves, record],
    lastMove: {
      from: record.from,
      to: record.to,
      ...(record.promotion ? { promotion: record.promotion } : {}),
    },
    // The mover's bank pays for the time they just spent; the opponent's
    // clock starts from `now`.
    whiteMs: role === WHITE_ROLE ? clock.whiteMs : state.whiteMs,
    blackMs: role === BLACK_ROLE ? clock.blackMs : state.blackMs,
    turnStartedAt: endReason === null ? now.toISOString() : null,
    // Any pending offer dies the moment a move is played.
    drawOfferBy: null,
    endReason,
    winner: outcome.status === "win" ? outcome.winner : null,
  };

  return { state: nextState, outcome, move: record };
}
