import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => ({ user: null, dbUser: null, loading: true }) }));
vi.mock("@/lib/hooks/useApiClient", () => ({ useApiClient: () => ({ apiFetch: vi.fn() }) }));

import {
  buildSoloLeaderboardUrl,
  formatSoloScore,
  splitVisibleSoloRows,
  type SoloLeaderboardEntry,
} from "./SoloLeaderboardPanel";

const visibleTopRows: SoloLeaderboardEntry[] = Array.from({ length: 10 }, (_, index) => ({
  userId: `user-${index + 1}`,
  primaryScore: 90 - index,
  secondaryScore: null,
  completedAt: "2026-08-20T12:00:00.000Z",
  rank: index + 1,
}));

describe("SoloLeaderboardPanel helpers", () => {
  it("builds one leaderboard request for the selected game, scope, and period", () => {
    expect(buildSoloLeaderboardUrl({ gameType: "REACTION", scope: "department", period: "week" }))
      .toBe("/api/minigames/solo/leaderboard?gameType=REACTION&period=week&scope=department");
  });

  it("pins the current player only when their rank falls outside the visible top rows", () => {
    const pinned: SoloLeaderboardEntry = {
      userId: "current-user",
      primaryScore: 72,
      secondaryScore: 420,
      completedAt: "2026-08-20T12:00:00.000Z",
      rank: 63,
    };

    expect(splitVisibleSoloRows([...visibleTopRows, pinned], "current-user")).toEqual({
      topRows: visibleTopRows,
      pinnedCurrentUser: pinned,
    });
    expect(splitVisibleSoloRows(visibleTopRows, "user-3")).toEqual({
      topRows: visibleTopRows,
      pinnedCurrentUser: null,
    });
  });

  it("formats official scores with the selected game’s published unit", () => {
    expect(formatSoloScore("TYPING", 74)).toBe("74 WPM");
    expect(formatSoloScore("REACTION", 243)).toBe("243 ms");
    expect(formatSoloScore("VISUAL_MEMORY", 11)).toBe("Level 11");
  });
});
