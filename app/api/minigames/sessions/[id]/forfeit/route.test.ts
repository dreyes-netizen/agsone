import { beforeEach, describe, expect, it, vi } from "vitest";
import { initChess, type ChessState } from "@/lib/minigames/chess";

/**
 * This route handles ALL 7 multiplayer game types generically, but only Chess
 * carries a clock in `state` — so a forfeit must freeze that clock (see the
 * final-review bug: a forfeited Chess game was rendering the loser's clock as
 * "00:00.0" on a fresh page load, reading as a timeout loss instead of a
 * forfeit). These tests exist to pin down exactly two things the pure Chess
 * logic in `lib/minigames/chess.test.ts` cannot: (1) a Chess forfeit writes a
 * frozen terminal `state` in the SAME update that flips status, and (2) every
 * other game type's update is completely untouched by that change.
 */

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  createNotification: vi.fn(),
  broadcastMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    gameSession: {
      findUnique: doubles.findUnique,
      updateMany: doubles.updateMany,
      update: doubles.update,
    },
    user: { update: vi.fn() },
    pointTransaction: { create: vi.fn() },
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

const params = Promise.resolve({ id: "session-1" });

function request() {
  return new Request("http://localhost/api/minigames/sessions/session-1/forfeit", {
    method: "POST",
  });
}

function call() {
  return POST(request() as never, { params });
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
    pointsWager: 0,
    currentTurn: HOST_ID,
    winnerId: null,
    ...overrides,
  };
}

describe("forfeit route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    doubles.verifyAuth.mockResolvedValue({ id: HOST_ID, displayName: "Ana" });
    doubles.findUnique.mockResolvedValue(session());
    doubles.updateMany.mockResolvedValue({ count: 1 });
    doubles.createNotification.mockResolvedValue(undefined);
    doubles.broadcastMany.mockResolvedValue(undefined);
    doubles.transaction.mockResolvedValue(undefined);
  });

  it("freezes the Chess clock and marks the terminal state 'forfeit' in the same update that flips status", async () => {
    // Host has been thinking for 90s of a 5-minute (300,000ms) bank; forfeit
    // lands mid-thought, so the frozen bank should reflect that, not 300000
    // and not 0.
    const turnStartedAt = new Date(Date.now() - 90_000).toISOString();
    doubles.findUnique.mockResolvedValue(
      session({ state: chessState({ turnStartedAt }) as unknown as Record<string, unknown> }),
    );

    const response = await call();

    expect(response.status).toBe(200);
    expect(doubles.updateMany).toHaveBeenCalledTimes(1);
    const [{ where, data }] = doubles.updateMany.mock.calls[0];
    expect(where).toEqual({ id: "session-1", status: "ACTIVE" });
    expect(data.status).toBe("FINISHED");
    // Host forfeited, so guest wins.
    expect(data.winnerId).toBe(GUEST_ID);
    expect(data.currentTurn).toBeNull();
    expect(data.state).toMatchObject({
      endReason: "forfeit",
      winner: "guest",
      drawOfferBy: null,
      turnStartedAt: null,
    });
    // White (host) was on move and had burned ~90s of a 300,000ms bank —
    // frozen remaining time should be roughly 210,000ms, never 0.
    expect(data.state.whiteMs).toBeGreaterThan(200_000);
    expect(data.state.whiteMs).toBeLessThan(300_000);
    // Black (guest) was not on move; its bank is untouched.
    expect(data.state.blackMs).toBe(300_000);
  });

  it("does not add a state field for a non-chess forfeit", async () => {
    doubles.findUnique.mockResolvedValue(
      session({ gameType: "TIC_TAC_TOE", state: { board: Array(9).fill(null) } }),
    );

    const response = await call();

    expect(response.status).toBe(200);
    expect(doubles.updateMany).toHaveBeenCalledTimes(1);
    const [{ data }] = doubles.updateMany.mock.calls[0];
    expect(data).toEqual({
      status: "FINISHED",
      winnerId: GUEST_ID,
      currentTurn: null,
    });
    expect("state" in data).toBe(false);
  });

  it("credits the guest as winner when the guest forfeits a Chess game", async () => {
    doubles.verifyAuth.mockResolvedValue({ id: GUEST_ID, displayName: "Bo" });
    doubles.findUnique.mockResolvedValue(session());

    expect((await call()).status).toBe(200);

    const [{ data }] = doubles.updateMany.mock.calls[0];
    expect(data.winnerId).toBe(HOST_ID);
    expect(data.state.winner).toBe("host");
  });

  it("409s a Chess forfeit when the game already ended (finishRes.count === 0), without touching notifications or points", async () => {
    doubles.updateMany.mockResolvedValue({ count: 0 });

    const response = await call();

    expect(response.status).toBe(409);
    expect(doubles.transaction).not.toHaveBeenCalled();
    expect(doubles.createNotification).not.toHaveBeenCalled();
    expect(doubles.broadcastMany).not.toHaveBeenCalled();
  });
});
