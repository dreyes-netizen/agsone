import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyChessMove, initChess, type ChessState } from "@/lib/minigames/chess";

/**
 * The pure "has a clock expired, and who wins" rule is covered in
 * `lib/minigames/chess.test.ts`. What only exists here is the part that moves
 * points: the `status` + `updatedAt` guard, and — unique to this route — the
 * refetch-once-and-recompute retry, which is the difference between correctly
 * settling a flagged game and ending a live one on a stale reading.
 */

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  txFinishUpdateMany: vi.fn(),
  txUserUpdate: vi.fn(),
  txPointCreate: vi.fn(),
  createNotification: vi.fn(),
  broadcastMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    gameSession: { findUnique: doubles.findUnique },
    $transaction: doubles.transaction,
  },
}));
vi.mock("@/lib/helpers/createNotification", () => ({
  createNotification: doubles.createNotification,
}));
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastMany: doubles.broadcastMany }));

import { POST } from "./route";

const HOST_ID = "host-1";
const GUEST_ID = "guest-1";
const VERSION = new Date("2026-08-22T00:00:00.000Z");
const NEXT_VERSION = new Date("2026-08-22T00:01:00.000Z");

const params = Promise.resolve({ id: "session-1" });

function call() {
  const request = new Request("http://localhost/api/minigames/sessions/session-1/timeout", {
    method: "POST",
  });
  return POST(request as never, { params });
}

/** A started game where White has been on move for `msAgo`. */
function whiteOnMove(msAgo: number): ChessState {
  return {
    ...initChess({ timeControlMinutes: 5 }),
    turnStartedAt: new Date(Date.now() - msAgo).toISOString(),
  };
}

/** The position after 1. e4 — Black is now on move with a fresh clock. */
function blackOnMove(): ChessState {
  return applyChessMove(whiteOnMove(2_000), { from: "e2", to: "e4" }, "host", new Date()).state;
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    gameType: "CHESS",
    hostId: HOST_ID,
    guestId: GUEST_ID,
    status: "ACTIVE",
    // White flagged: 5 minutes of bank, 5m01s on the clock.
    state: whiteOnMove(301_000) as unknown as Record<string, unknown>,
    pointsWager: 50,
    currentTurn: HOST_ID,
    winnerId: null,
    updatedAt: VERSION,
    ...overrides,
  };
}

/**
 * Runs the route's transaction callback against tx doubles the way Prisma
 * would. Each argument is the `count` the guarded finish returns on the
 * corresponding attempt, so a race can be scripted across the retry.
 */
function runTransaction(...counts: number[]) {
  // Replace, don't append: `beforeEach` scripts the happy path, and a test that
  // wants to script a race must not end up queued BEHIND that count of 1.
  doubles.txFinishUpdateMany.mockReset();
  counts.forEach((count) => doubles.txFinishUpdateMany.mockResolvedValueOnce({ count }));
  doubles.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
    fn({
      gameSession: { updateMany: doubles.txFinishUpdateMany },
      user: { update: doubles.txUserUpdate },
      pointTransaction: { create: doubles.txPointCreate },
    }),
  );
}

function expectNoPayout() {
  expect(doubles.txUserUpdate).not.toHaveBeenCalled();
  expect(doubles.txPointCreate).not.toHaveBeenCalled();
}

describe("chess timeout route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    doubles.verifyAuth.mockResolvedValue({ id: GUEST_ID, displayName: "Ben" });
    doubles.findUnique.mockResolvedValue(session());
    doubles.createNotification.mockResolvedValue(undefined);
    doubles.broadcastMany.mockResolvedValue(undefined);
    runTransaction(1);
  });

  // --- guards --------------------------------------------------------------

  it("rejects unauthenticated requests before reading the session", async () => {
    doubles.verifyAuth.mockResolvedValue(null);

    expect((await call()).status).toBe(401);
    expect(doubles.findUnique).not.toHaveBeenCalled();
  });

  it("404s on a missing session", async () => {
    doubles.findUnique.mockResolvedValue(null);

    expect((await call()).status).toBe(404);
  });

  it("400s on a non-chess game", async () => {
    doubles.findUnique.mockResolvedValue(session({ gameType: "CONNECT_FOUR" }));

    expect((await call()).status).toBe(400);
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  it("409s when the game is no longer active", async () => {
    doubles.findUnique.mockResolvedValue(session({ status: "FINISHED" }));

    expect((await call()).status).toBe(409);
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  it("403s a spectator who is neither host nor guest", async () => {
    doubles.verifyAuth.mockResolvedValue({ id: "onlooker-1", displayName: "Nosy" });

    expect((await call()).status).toBe(403);
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  it("400s when there is no opponent to award the win to", async () => {
    doubles.findUnique.mockResolvedValue(session({ guestId: null }));
    doubles.verifyAuth.mockResolvedValue({ id: HOST_ID, displayName: "Ana" });

    expect((await call()).status).toBe(400);
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  // --- the server, not the client, decides ---------------------------------

  it("409s a claim against a clock that is still running, and settles nothing", async () => {
    doubles.findUnique.mockResolvedValue(session({ state: whiteOnMove(5_000) }));

    const response = await call();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Clock has not expired" });
    expect(doubles.transaction).not.toHaveBeenCalled();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });

  it("409s a claim on a game whose clock never started", async () => {
    doubles.findUnique.mockResolvedValue(
      session({ state: initChess({ timeControlMinutes: 5 }) }),
    );

    expect((await call()).status).toBe(409);
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  // --- scenario A: genuine expiry ------------------------------------------

  it("settles an expired White clock as a guest win and pays the pot once", async () => {
    doubles.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce({ ...session(), status: "FINISHED", winnerId: GUEST_ID });

    const response = await call();

    expect(response.status).toBe(200);

    // Guarded on status AND the exact version read; the status flip and the
    // terminal `state` are written together, so ACTIVE never coexists with a
    // non-null endReason (the draw route's accept path depends on this).
    expect(doubles.txFinishUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", status: "ACTIVE", updatedAt: VERSION },
      }),
    );
    const [{ data }] = doubles.txFinishUpdateMany.mock.calls[0];
    expect(data).toMatchObject({ status: "FINISHED", currentTurn: null, winnerId: GUEST_ID });
    expect(data.state).toMatchObject({
      endReason: "timeout",
      winner: "guest",
      drawOfferBy: null,
      // Frozen: the flagged side at zero, and nothing left ticking.
      turnStartedAt: null,
      whiteMs: 0,
      blackMs: 300_000,
    });

    // 2x pot to the winner, exactly once.
    expect(doubles.txUserUpdate).toHaveBeenCalledTimes(1);
    expect(doubles.txUserUpdate).toHaveBeenCalledWith({
      where: { id: GUEST_ID },
      data: { pointsBalance: { increment: 100 } },
    });
    expect(doubles.txPointCreate).toHaveBeenCalledTimes(1);
    expect(doubles.txPointCreate.mock.calls[0][0].data).toMatchObject({
      toUserId: GUEST_ID,
      fromUserId: HOST_ID,
      amount: 100,
      type: "GAME_WIN",
    });

    expect(doubles.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: GUEST_ID,
        type: "GAME_WIN",
        title: "Chess — You won on time! ⏱️",
      }),
    );
    expect(doubles.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: HOST_ID,
        type: "GAME_LOST",
        title: "Chess — Time expired",
      }),
    );

    expect(doubles.broadcastMany.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        { topic: "game:session-1" },
        { topic: "lobby" },
        { topic: "minigames:stats" },
        { topic: "admin:analytics" },
        { topic: `profile:${HOST_ID}` },
        { topic: `profile:${GUEST_ID}` },
        { topic: "points:transactions" },
        { topic: "leaderboard" },
      ]),
    );
  });

  it("settles an expired Black clock as a host win", async () => {
    // 1. e4 played, then Black sat on it for over five minutes.
    const flagged: ChessState = { ...blackOnMove(), turnStartedAt: new Date(Date.now() - 301_000).toISOString() };
    doubles.findUnique.mockResolvedValue(session({ state: flagged }));

    expect((await call()).status).toBe(200);

    const [{ data }] = doubles.txFinishUpdateMany.mock.calls[0];
    expect(data.winnerId).toBe(HOST_ID);
    expect(data.state).toMatchObject({ winner: "host", endReason: "timeout", blackMs: 0 });
    expect(doubles.txUserUpdate).toHaveBeenCalledWith({
      where: { id: HOST_ID },
      data: { pointsBalance: { increment: 100 } },
    });
  });

  it("the flagged player's own client may claim the timeout, and still loses", async () => {
    // Whoever asks, the clock decides. Host is White and out of time.
    doubles.verifyAuth.mockResolvedValue({ id: HOST_ID, displayName: "Ana" });

    expect((await call()).status).toBe(200);
    expect(doubles.txFinishUpdateMany.mock.calls[0][0].data.winnerId).toBe(GUEST_ID);
  });

  it("skips the points topics and the payout when the game carried no wager", async () => {
    doubles.findUnique.mockResolvedValue(session({ pointsWager: 0 }));

    expect((await call()).status).toBe(200);
    expectNoPayout();
    expect(doubles.broadcastMany.mock.calls[0][0]).not.toContainEqual({ topic: "leaderboard" });
  });

  // --- scenario B: a move lands first --------------------------------------

  it("does not settle when a move landed first and the fresh clock is live", async () => {
    // The version guard misses (count 0), the refetch shows the game still
    // ACTIVE, and the move that beat us handed the turn to Black with a fresh
    // clock — so the stale "White timed out" claim is simply no longer true.
    doubles.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(session({ state: blackOnMove(), updatedAt: NEXT_VERSION }));
    // A second attempt is deliberately scripted to SUCCEED. Nothing should ever
    // reach it: if the route settled on the stale outcome instead of recomputing
    // it would end a live game here, and the assertions below would catch it.
    runTransaction(0, 1);

    const response = await call();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Clock has not expired" });
    // One transaction attempt only, and it moved nothing.
    expect(doubles.txFinishUpdateMany).toHaveBeenCalledTimes(1);
    expectNoPayout();
    expect(doubles.createNotification).not.toHaveBeenCalled();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });

  it("retries against the fresh row when the refetched clock really is expired", async () => {
    // Lost the first race to an unrelated write (a draw offer, say), but the
    // game is still active and White is still out of time.
    const fresh = session({ state: whiteOnMove(400_000), updatedAt: NEXT_VERSION });
    doubles.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(fresh)
      .mockResolvedValueOnce({ ...fresh, status: "FINISHED", winnerId: GUEST_ID });
    runTransaction(0, 1);

    expect((await call()).status).toBe(200);

    // The second attempt is guarded on the REFETCHED version, not the stale one.
    expect(doubles.txFinishUpdateMany).toHaveBeenCalledTimes(2);
    expect(doubles.txFinishUpdateMany.mock.calls[1][0].where).toEqual({
      id: "session-1",
      status: "ACTIVE",
      updatedAt: NEXT_VERSION,
    });
    // Still exactly one payout, on the attempt that performed the flip.
    expect(doubles.txUserUpdate).toHaveBeenCalledTimes(1);
    expect(doubles.txPointCreate).toHaveBeenCalledTimes(1);
  });

  it("gives up with a 409 rather than looping when the retry also loses", async () => {
    doubles.findUnique.mockResolvedValue(session({ state: whiteOnMove(400_000) }));
    runTransaction(0, 0);

    const response = await call();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Game changed — please retry" });
    expect(doubles.txFinishUpdateMany).toHaveBeenCalledTimes(2);
    expectNoPayout();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });

  // --- idempotency ---------------------------------------------------------

  it("returns the terminal state without paying again when another request already settled", async () => {
    // The duplicate claim: a racing timeout/move/draw-accept won the flip.
    const finished = {
      ...session(),
      status: "FINISHED",
      winnerId: GUEST_ID,
      updatedAt: NEXT_VERSION,
    };
    doubles.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(finished)
      .mockResolvedValueOnce(finished);
    // As above: the second attempt would succeed if the route ever made one, so
    // "no double payout" is asserted against a route that COULD have paid twice.
    runTransaction(0, 1);

    const response = await call();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "FINISHED", winnerId: GUEST_ID });
    // No second attempt, no second payout, and no duplicate result notifications.
    expect(doubles.txFinishUpdateMany).toHaveBeenCalledTimes(1);
    expectNoPayout();
    expect(doubles.createNotification).not.toHaveBeenCalled();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });
});
