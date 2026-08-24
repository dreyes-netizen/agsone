import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyChessMove, initChess, startChessClock, type ChessMoveInput, type ChessState } from "@/lib/minigames/chess";

/**
 * Route-level regression coverage for the CHESS case of the shared move
 * endpoint. The pure legality/clock/outcome rules are covered in
 * `lib/minigames/chess.test.ts` — this file only covers what that file
 * cannot: turn/clock guards enforced by the route itself, the
 * ACTIVE -> FINISHED version-guarded write, the idempotent wager payout that
 * rides only on `didFinish`, and confirming the route ignores every field in
 * the request body except from/to/promotion.
 *
 * Adapted Task 11 (per user decision): the plan's original Task 11 called for
 * a Playwright E2E spec, but this repo has no `tests/` directory, no
 * `playwright.config.ts`, and no authenticated E2E fixture to reuse. The user
 * chose to skip Playwright entirely and rely on this Vitest route-level net
 * instead — the same pattern already used for the sibling draw/timeout
 * routes, which explicitly call out that Task 11 was meant to own the
 * browser pass.
 */

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  userUpdate: vi.fn(),
  pointTransactionCreate: vi.fn(),
  createNotification: vi.fn(),
  broadcastMany: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    gameSession: {
      findUnique: doubles.findUnique,
      updateMany: doubles.updateMany,
    },
    user: { update: doubles.userUpdate },
    pointTransaction: { create: doubles.pointTransactionCreate },
    $transaction: doubles.transaction,
  },
}));
vi.mock("@/lib/helpers/createNotification", () => ({
  createNotification: doubles.createNotification,
}));
vi.mock("@/lib/realtime/broadcast", () => ({
  broadcastMany: doubles.broadcastMany,
}));
vi.mock("@/lib/guardrails/rateLimiter", () => ({
  checkRateLimit: doubles.checkRateLimit,
}));

import { POST } from "./route";

const HOST_ID = "host-1";
const GUEST_ID = "guest-1";
const VERSION = new Date("2026-08-22T00:00:00.000Z");

const params = Promise.resolve({ id: "session-1" });

function request(body: unknown) {
  return new Request("http://localhost/api/minigames/sessions/session-1/move", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function call(body: unknown) {
  return POST(request(body) as never, { params });
}

/**
 * A fresh, clock-started chess position — host (White) to move.
 *
 * The route reads real wall time (`new Date()`) when applying a move, so the
 * clock has to be started relative to actual now — not the fixed `VERSION`
 * timestamp used only for the row's optimistic-concurrency `updatedAt`.
 */
function chessState(overrides: Partial<ChessState> = {}): ChessState {
  const started = startChessClock(initChess({ timeControlMinutes: 5 }), new Date());
  return { ...started, ...overrides };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    gameType: "CHESS",
    hostId: HOST_ID,
    guestId: GUEST_ID,
    status: "ACTIVE",
    state: chessState() as unknown as Record<string, unknown>,
    pointsWager: 50,
    currentTurn: HOST_ID,
    winnerId: null,
    updatedAt: VERSION,
    ...overrides,
  };
}

/** 1. f3 e5 2. g4 — one legal guest move (Qh4#) away from Fool's mate. */
function oneMoveFromFoolsMate(): ChessState {
  let state = chessState();
  const setup: { move: ChessMoveInput; role: "host" | "guest" }[] = [
    { move: { from: "f2", to: "f3" }, role: "host" },
    { move: { from: "e7", to: "e5" }, role: "guest" },
    { move: { from: "g2", to: "g4" }, role: "host" },
  ];
  for (const { move, role } of setup) {
    state = applyChessMove(state, move, role, new Date()).state;
  }
  return state;
}

/** Sam Loyd's stalemate, one White move (Qe6) short of completion — Black to move next after. */
function oneMoveFromLoydStalemate(): ChessState {
  const moves: { move: ChessMoveInput; role: "host" | "guest" }[] = [
    { move: { from: "e2", to: "e3" }, role: "host" },
    { move: { from: "a7", to: "a5" }, role: "guest" },
    { move: { from: "d1", to: "h5" }, role: "host" },
    { move: { from: "a8", to: "a6" }, role: "guest" },
    { move: { from: "h5", to: "a5" }, role: "host" },
    { move: { from: "h7", to: "h5" }, role: "guest" },
    { move: { from: "a5", to: "c7" }, role: "host" },
    { move: { from: "a6", to: "h6" }, role: "guest" },
    { move: { from: "h2", to: "h4" }, role: "host" },
    { move: { from: "f7", to: "f6" }, role: "guest" },
    { move: { from: "c7", to: "d7" }, role: "host" },
    { move: { from: "e8", to: "f7" }, role: "guest" },
    { move: { from: "d7", to: "b7" }, role: "host" },
    { move: { from: "d8", to: "d3" }, role: "guest" },
    { move: { from: "b7", to: "b8" }, role: "host" },
    { move: { from: "d3", to: "h7" }, role: "guest" },
    { move: { from: "b8", to: "c8" }, role: "host" },
    { move: { from: "f7", to: "g6" }, role: "guest" },
  ];
  let state = chessState();
  for (const { move, role } of moves) {
    state = applyChessMove(state, move, role, new Date()).state;
  }
  return state;
}

describe("chess move route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    doubles.verifyAuth.mockResolvedValue({ id: HOST_ID, displayName: "Ana" });
    doubles.findUnique.mockResolvedValue(session());
    doubles.updateMany.mockResolvedValue({ count: 1 });
    doubles.userUpdate.mockResolvedValue(undefined);
    doubles.pointTransactionCreate.mockResolvedValue(undefined);
    doubles.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    doubles.createNotification.mockResolvedValue(undefined);
    doubles.broadcastMany.mockResolvedValue(undefined);
    doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 1 });
  });

  // --- 1. legal move, game continues ---------------------------------------

  it("applies a legal move by the player on turn, passes the turn, settles nothing", async () => {
    doubles.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce({ ...session(), currentTurn: GUEST_ID });

    const response = await call({ from: "e2", to: "e4" });

    expect(response.status).toBe(200);
    expect(doubles.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", updatedAt: VERSION },
      data: expect.objectContaining({ currentTurn: GUEST_ID }),
    });
    const written = doubles.updateMany.mock.calls[0][0].data.state as ChessState;
    expect(written.moves).toHaveLength(1);
    expect(written.moves[0]).toMatchObject({ from: "e2", to: "e4" });
    expect(written.endReason).toBeNull();

    // Ongoing — no finishing write, no payout, no result notifications.
    expect(doubles.transaction).not.toHaveBeenCalled();
    expect(doubles.createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "GAME_WIN" }),
    );

    const body = await response.json();
    expect(body.data.state.endReason).toBeNull();
  });

  // --- 2. not your turn -----------------------------------------------------

  it("rejects a move from the player who is not session.currentTurn", async () => {
    doubles.verifyAuth.mockResolvedValue({ id: GUEST_ID, displayName: "Ben" });
    // currentTurn is still HOST_ID (default session()).

    const response = await call({ from: "e7", to: "e5" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Not your turn" });
    expect(doubles.updateMany).not.toHaveBeenCalled();
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  // --- 3. illegal move --------------------------------------------------------

  it("rejects an illegal move with no state mutation", async () => {
    const response = await call({ from: "e2", to: "e5" }); // pawn can't jump 3 squares

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Illegal move" });
    expect(doubles.updateMany).not.toHaveBeenCalled();
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  // --- 4. clock expired: reject, don't auto-settle ---------------------------

  it("rejects a move after the mover's own clock has expired, without settling the game", async () => {
    const expired = chessState({
      turnStartedAt: new Date(Date.now() - 301_000).toISOString(), // 5m01s elapsed on a 5m clock
    });
    doubles.findUnique.mockResolvedValue(session({ state: expired }));

    const response = await call({ from: "e2", to: "e4" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Clock expired" });
    // Not settled here — timeout route is the only settlement path for this.
    expect(doubles.updateMany).not.toHaveBeenCalled();
    expect(doubles.transaction).not.toHaveBeenCalled();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });

  // --- 5. checkmate: finish + pay the winner exactly once --------------------

  it("settles checkmate, marks FINISHED with the mover as winner, and pays the pot once", async () => {
    const setup = oneMoveFromFoolsMate();
    doubles.verifyAuth.mockResolvedValue({ id: GUEST_ID, displayName: "Ben" });
    const preMate = session({ state: setup, currentTurn: GUEST_ID });
    doubles.findUnique
      .mockResolvedValueOnce(preMate)
      .mockResolvedValueOnce({ ...preMate, status: "FINISHED", winnerId: GUEST_ID });

    const response = await call({ from: "d8", to: "h4" });

    expect(response.status).toBe(200);
    expect(doubles.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", status: "ACTIVE" },
      data: expect.objectContaining({ status: "FINISHED", currentTurn: null, winnerId: GUEST_ID }),
    });
    const finishedState = doubles.updateMany.mock.calls[0][0].data.state as ChessState;
    expect(finishedState.endReason).toBe("checkmate");
    expect(finishedState.winner).toBe("guest");

    // 2x pot to the winner, exactly once.
    expect(doubles.transaction).toHaveBeenCalledTimes(1);
    expect(doubles.userUpdate).toHaveBeenCalledTimes(1);
    expect(doubles.userUpdate).toHaveBeenCalledWith({
      where: { id: GUEST_ID },
      data: { pointsBalance: { increment: 100 } },
    });
    expect(doubles.pointTransactionCreate).toHaveBeenCalledTimes(1);
    expect(doubles.pointTransactionCreate.mock.calls[0][0].data).toMatchObject({
      toUserId: GUEST_ID,
      fromUserId: HOST_ID,
      amount: 100,
      type: "GAME_WIN",
    });

    expect(doubles.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: GUEST_ID, type: "GAME_WIN" }),
    );
    expect(doubles.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: HOST_ID, type: "GAME_LOST" }),
    );
  });

  // --- 6. automatic draw: refund each player's own wager ---------------------

  it("settles stalemate as a draw and refunds each player their own wager", async () => {
    const setup = oneMoveFromLoydStalemate();
    // Host (White) plays the final move, Qe6, delivering stalemate to Black.
    const preStalemate = session({ state: setup, currentTurn: HOST_ID });
    doubles.findUnique
      .mockResolvedValueOnce(preStalemate)
      .mockResolvedValueOnce({ ...preStalemate, status: "FINISHED", winnerId: null });

    const response = await call({ from: "c8", to: "e6" });

    expect(response.status).toBe(200);
    const [{ where, data }] = doubles.updateMany.mock.calls[0];
    expect(where).toEqual({ id: "session-1", status: "ACTIVE" });
    expect(data.status).toBe("FINISHED");
    expect(data.currentTurn).toBeNull();
    expect(data.winnerId).toBeUndefined();
    const finishedState = data.state as ChessState;
    expect(finishedState.endReason).toBe("stalemate");
    expect(finishedState.winner).toBeNull();

    // Own stake back (50) each, not the 2x pot a decisive win pays.
    expect(doubles.transaction).toHaveBeenCalledTimes(1);
    expect(doubles.userUpdate).toHaveBeenCalledTimes(2);
    expect(doubles.userUpdate).toHaveBeenCalledWith({
      where: { id: HOST_ID },
      data: { pointsBalance: { increment: 50 } },
    });
    expect(doubles.userUpdate).toHaveBeenCalledWith({
      where: { id: GUEST_ID },
      data: { pointsBalance: { increment: 50 } },
    });
    expect(doubles.pointTransactionCreate).toHaveBeenCalledTimes(2);

    expect(doubles.createNotification).toHaveBeenCalledTimes(2);
    expect(doubles.createNotification.mock.calls.every(([n]) => n.type === "GAME_DRAW")).toBe(true);
  });

  // --- 7. idempotency: no double payout on a lost finishing race -------------

  it("does not attempt a payout when the finishing write loses the race (didFinish false)", async () => {
    const setup = oneMoveFromFoolsMate();
    doubles.verifyAuth.mockResolvedValue({ id: GUEST_ID, displayName: "Ben" });
    const preMate = session({ state: setup, currentTurn: GUEST_ID });
    // A racing write (e.g. a timeout claim) already flipped the game to
    // FINISHED first, so our version/status-guarded write matches 0 rows.
    doubles.findUnique
      .mockResolvedValueOnce(preMate)
      .mockResolvedValueOnce({ ...preMate, status: "FINISHED", winnerId: HOST_ID });
    doubles.updateMany.mockResolvedValue({ count: 0 });

    const response = await call({ from: "d8", to: "h4" });

    // The route still returns 200 with the (now stale, already-settled) row —
    // it does not error on a lost finishing race.
    expect(response.status).toBe(200);
    expect(doubles.updateMany).toHaveBeenCalledTimes(1);

    // didFinish was false, so the payout branch is never entered.
    expect(doubles.transaction).not.toHaveBeenCalled();
    expect(doubles.userUpdate).not.toHaveBeenCalled();
    expect(doubles.pointTransactionCreate).not.toHaveBeenCalled();
    expect(doubles.createNotification).not.toHaveBeenCalled();
  });

  // --- 8. hostile body: only from/to/promotion are trusted -------------------

  it("ignores every request field except from/to/promotion", async () => {
    // Same starting state fed to the mocked read and to the reference
    // computation below, so both start from identical moves/fen — only wall
    // time (a few ms apart, both calls made moments apart in this test) can
    // differ, which is why the clock fields are asserted as ranges rather
    // than exact equality below.
    const startState = chessState();
    doubles.findUnique
      .mockResolvedValueOnce(session({ state: startState }))
      .mockResolvedValueOnce({ ...session(), currentTurn: GUEST_ID });

    const response = await call({
      from: "e2",
      to: "e4",
      // Hostile extras: a fabricated FEN/PGN, a fake winner, forged clocks,
      // and an attempt to declare the game finished outright. None of these
      // are read by the route — only from/to/promotion are.
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      pgn: "1. e4 Qxe4#",
      winner: "guest",
      endReason: "checkmate",
      whiteMs: 1,
      blackMs: 999_999,
      status: "FINISHED",
    });

    expect(response.status).toBe(200);
    const written = doubles.updateMany.mock.calls[0][0].data.state as ChessState;

    // The move actually applied is the real, legal e2-e4 — derived from the
    // persisted move list, not the hostile fen/pgn.
    expect(written.moves).toHaveLength(1);
    expect(written.moves[0]).toEqual({ from: "e2", to: "e4", san: "e4" });
    expect(written.fen).not.toBe("8/8/8/8/8/8/8/8 w - - 0 1");
    expect(written.pgn).not.toBe("1. e4 Qxe4#");

    // Server-computed outcome: the game is still ongoing after one opening
    // move, regardless of the client's forged "winner"/"endReason"/"status".
    expect(written.endReason).toBeNull();
    expect(written.winner).toBeNull();

    // Server-computed clocks (real elapsed time off the mover's own bank),
    // not the forged whiteMs/blackMs from the request body.
    expect(written.whiteMs).toBeGreaterThan(299_000);
    expect(written.whiteMs).toBeLessThanOrEqual(300_000);
    expect(written.blackMs).toBe(300_000);

    const body = await response.json();
    expect(body.data.status).toBe("ACTIVE");
  });
});
