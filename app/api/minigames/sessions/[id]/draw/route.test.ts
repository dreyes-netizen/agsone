import { beforeEach, describe, expect, it, vi } from "vitest";
import { initChess, offerChessDraw, type ChessState } from "@/lib/minigames/chess";

/**
 * These tests exist for one reason: this route settles a wager. The pure draw
 * rules live in `lib/minigames/chess.test.ts`; what cannot be covered there is
 * the part that actually moves points — the `status` + `updatedAt` guard, and
 * the fact that a refund can only ever ride on the single request that
 * performed the ACTIVE -> FINISHED transition. Task 11 owns the browser E2E
 * pass; this is the regression net under the money path.
 */

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  txFinishUpdateMany: vi.fn(),
  txUserUpdate: vi.fn(),
  txPointCreateMany: vi.fn(),
  createNotification: vi.fn(),
  broadcastMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    gameSession: {
      findUnique: doubles.findUnique,
      updateMany: doubles.updateMany,
    },
    $transaction: doubles.transaction,
  },
}));
vi.mock("@/lib/helpers/createNotification", () => ({
  createNotification: doubles.createNotification,
}));
vi.mock("@/lib/realtime/broadcast", () => ({
  broadcastMany: doubles.broadcastMany,
}));

import { POST } from "./route";

const HOST_ID = "host-1";
const GUEST_ID = "guest-1";
const VERSION = new Date("2026-08-22T00:00:00.000Z");

const params = Promise.resolve({ id: "session-1" });

function request(body: unknown) {
  return new Request("http://localhost/api/minigames/sessions/session-1/draw", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function call(body: unknown) {
  return POST(request(body) as never, { params });
}

function chessState(overrides: Partial<ChessState> = {}): ChessState {
  return { ...initChess({ timeControlMinutes: 5 }), ...overrides };
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

/** Runs the route's transaction callback against tx doubles, like Prisma would. */
function runTransaction(finishCount: number) {
  doubles.txFinishUpdateMany.mockResolvedValue({ count: finishCount });
  doubles.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
    fn({
      gameSession: { updateMany: doubles.txFinishUpdateMany },
      user: { update: doubles.txUserUpdate },
      pointTransaction: { createMany: doubles.txPointCreateMany },
    }),
  );
}

describe("chess draw route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    doubles.verifyAuth.mockResolvedValue({ id: HOST_ID, displayName: "Ana" });
    doubles.findUnique.mockResolvedValue(session());
    doubles.updateMany.mockResolvedValue({ count: 1 });
    doubles.createNotification.mockResolvedValue(undefined);
    doubles.broadcastMany.mockResolvedValue(undefined);
  });

  // --- guards --------------------------------------------------------------

  it("rejects unauthenticated requests before reading the session", async () => {
    doubles.verifyAuth.mockResolvedValue(null);

    expect((await call({ action: "offer" })).status).toBe(401);
    expect(doubles.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an action outside the three allowed verbs", async () => {
    const response = await call({ action: "resign" });

    expect(response.status).toBe(400);
    expect(doubles.updateMany).not.toHaveBeenCalled();
  });

  it("404s on a missing session", async () => {
    doubles.findUnique.mockResolvedValue(null);

    expect((await call({ action: "offer" })).status).toBe(404);
  });

  it("400s on a non-chess game", async () => {
    doubles.findUnique.mockResolvedValue(session({ gameType: "CONNECT_FOUR" }));

    expect((await call({ action: "offer" })).status).toBe(400);
  });

  it("409s when the game is no longer active", async () => {
    doubles.findUnique.mockResolvedValue(session({ status: "FINISHED" }));

    expect((await call({ action: "offer" })).status).toBe(409);
  });

  it("403s a spectator who is neither host nor guest", async () => {
    doubles.verifyAuth.mockResolvedValue({ id: "onlooker-1", displayName: "Nosy" });

    const response = await call({ action: "offer" });

    expect(response.status).toBe(403);
    expect(doubles.updateMany).not.toHaveBeenCalled();
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  // --- offer / decline version guard ---------------------------------------

  it("writes an offer guarded on the exact row version it read", async () => {
    doubles.findUnique.mockResolvedValueOnce(session()).mockResolvedValueOnce(session());

    const response = await call({ action: "offer" });

    expect(response.status).toBe(200);
    expect(doubles.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", status: "ACTIVE", updatedAt: VERSION },
      }),
    );
    const [{ data }] = doubles.updateMany.mock.calls[0];
    expect(data.state.drawOfferBy).toBe("host");
    expect(doubles.broadcastMany).toHaveBeenCalledWith([{ topic: "game:session-1" }]);
  });

  it("409s instead of overwriting newer state when the row moved under an offer", async () => {
    doubles.updateMany.mockResolvedValue({ count: 0 });

    const response = await call({ action: "offer" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Game changed — please retry" });
    // Exactly one attempt, and no unguarded fallback write.
    expect(doubles.updateMany).toHaveBeenCalledTimes(1);
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });

  it("409s a stale decline rather than clobbering the move that cleared the offer", async () => {
    doubles.findUnique.mockResolvedValue(
      session({ state: offerChessDraw(chessState(), "guest") }),
    );
    doubles.updateMany.mockResolvedValue({ count: 0 });

    expect((await call({ action: "decline" })).status).toBe(409);
  });

  it("clears the offer on a valid decline", async () => {
    doubles.findUnique.mockResolvedValue(
      session({ state: offerChessDraw(chessState(), "guest") }),
    );

    expect((await call({ action: "decline" })).status).toBe(200);
    const [{ data }] = doubles.updateMany.mock.calls[0];
    expect(data.state.drawOfferBy).toBeNull();
  });

  it("400s a decline with nothing outstanding", async () => {
    const response = await call({ action: "decline" });

    expect(response.status).toBe(400);
    expect(doubles.updateMany).not.toHaveBeenCalled();
  });

  // --- accept --------------------------------------------------------------

  it("400s an accept with no offer outstanding", async () => {
    const response = await call({ action: "accept" });

    expect(response.status).toBe(400);
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  it("does not allow accepting your own draw offer", async () => {
    doubles.findUnique.mockResolvedValue(
      session({ state: offerChessDraw(chessState(), "host") }),
    );

    const response = await call({ action: "accept" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Cannot accept your own draw offer" });
    expect(doubles.transaction).not.toHaveBeenCalled();
  });

  it("settles the draw and refunds each player their OWN stake, in one transaction", async () => {
    const offered = session({ state: offerChessDraw(chessState(), "guest") });
    doubles.findUnique
      .mockResolvedValueOnce(offered)
      .mockResolvedValueOnce({ ...offered, status: "FINISHED" });
    runTransaction(1);

    const response = await call({ action: "accept" });

    expect(response.status).toBe(200);

    // The finish is guarded on status AND the exact version we read.
    expect(doubles.txFinishUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1", status: "ACTIVE", updatedAt: VERSION },
      }),
    );
    const [{ data }] = doubles.txFinishUpdateMany.mock.calls[0];
    expect(data).toMatchObject({ status: "FINISHED", currentTurn: null, winnerId: null });
    expect(data.state).toMatchObject({ endReason: "draw_agreement", drawOfferBy: null, winner: null });

    // Own stake back (50), not the 2x pot a decisive win pays. Once each.
    expect(doubles.txUserUpdate).toHaveBeenCalledTimes(2);
    expect(doubles.txUserUpdate).toHaveBeenCalledWith({
      where: { id: HOST_ID },
      data: { pointsBalance: { increment: 50 } },
    });
    expect(doubles.txUserUpdate).toHaveBeenCalledWith({
      where: { id: GUEST_ID },
      data: { pointsBalance: { increment: 50 } },
    });
    expect(doubles.txPointCreateMany).toHaveBeenCalledTimes(1);
    expect(doubles.txPointCreateMany.mock.calls[0][0].data).toHaveLength(2);

    expect(doubles.createNotification).toHaveBeenCalledTimes(2);
    expect(doubles.createNotification.mock.calls.every(([n]) => n.type === "GAME_DRAW")).toBe(true);
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

  it("skips the points topics when the game carried no wager", async () => {
    const offered = session({ pointsWager: 0, state: offerChessDraw(chessState(), "guest") });
    doubles.findUnique.mockResolvedValue(offered);
    runTransaction(1);

    expect((await call({ action: "accept" })).status).toBe(200);
    expect(doubles.txUserUpdate).not.toHaveBeenCalled();
    expect(doubles.txPointCreateMany).not.toHaveBeenCalled();
    expect(doubles.broadcastMany.mock.calls[0][0]).not.toContainEqual({ topic: "leaderboard" });
  });

  it("refuses to refund twice when a racing request already settled the game", async () => {
    doubles.findUnique.mockResolvedValue(
      session({ state: offerChessDraw(chessState(), "guest") }),
    );
    // The racing accept won the ACTIVE -> FINISHED flip, so ours matches 0 rows.
    runTransaction(0);

    const response = await call({ action: "accept" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Game changed — please retry" });
    // Everything after the guard is inside the same transaction that just
    // threw, so nothing was credited and no notification/broadcast escaped.
    expect(doubles.txUserUpdate).not.toHaveBeenCalled();
    expect(doubles.txPointCreateMany).not.toHaveBeenCalled();
    expect(doubles.createNotification).not.toHaveBeenCalled();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });
});
