import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, dbUser: null, loading: true }),
}));
vi.mock("@/lib/hooks/useApiClient", () => ({
  useApiClient: () => ({ apiFetch: vi.fn() }),
}));

import {
  buildSoloLeaderboardUrl,
  createSoloChampionRequestLifecycle,
  formatSoloScore,
  SoloLeaderboardResults,
  splitVisibleSoloRows,
  type SoloLeaderboardEntry,
} from "./SoloLeaderboardPanel";

const visibleTopRows: SoloLeaderboardEntry[] = Array.from(
  { length: 10 },
  (_, index) => ({
    userId: `user-${index + 1}`,
    primaryScore: 90 - index,
    secondaryScore: null,
    completedAt: "2026-08-20T12:00:00.000Z",
    rank: index + 1,
  }),
);

describe("SoloLeaderboardPanel helpers", () => {
  it("builds one leaderboard request for the selected game, scope, and period", () => {
    expect(
      buildSoloLeaderboardUrl({
        gameType: "REACTION",
        scope: "department",
        period: "week",
      }),
    ).toBe(
      "/api/minigames/solo/leaderboard?gameType=REACTION&period=week&scope=department",
    );
  });

  it("pins the current player only when their rank falls outside the visible top rows", () => {
    const pinned: SoloLeaderboardEntry = {
      userId: "current-user",
      primaryScore: 72,
      secondaryScore: 420,
      completedAt: "2026-08-20T12:00:00.000Z",
      rank: 63,
    };

    expect(
      splitVisibleSoloRows([...visibleTopRows, pinned], "current-user"),
    ).toEqual({
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

  it("renders the API's allTime summary, database current user, and secondary tiebreak scores", () => {
    const current: SoloLeaderboardEntry = {
      userId: "database-user-id",
      primaryScore: 77,
      secondaryScore: 9_915,
      completedAt: "2026-08-20T12:00:00.000Z",
      rank: 11,
    };
    const html = renderToStaticMarkup(
      createElement(SoloLeaderboardResults, {
        gameType: "TYPING",
        period: "alltime",
        scope: "company",
        entries: [current],
        currentUserId: "database-user-id",
        currentUserName: "Rae",
        loadingBoard: false,
        boardError: null,
        loadingSummary: false,
        summary: {
          personalBest: current,
          ranks: {
            week: { company: null, department: null },
            allTime: { company: current, department: null },
          },
        },
        champions: [
          {
            id: "champion-1",
            gameType: "TYPING",
            weekStart: "2026-08-17T00:00:00.000Z",
            primaryScore: 77,
            secondaryScore: 9_915,
            user: { displayName: "Rae", avatarUrl: null },
          },
        ],
      }),
    );

    expect(html).toContain("All-time company rank");
    expect(html).toContain("#11");
    expect(html).toContain("Rae (You)");
    expect(html.match(/Accuracy 99\.15%/g)).toHaveLength(4);
  });

  it("replays the champions request after Strict Mode cleanup and ignores the stale response", async () => {
    const resolvers: Array<(value: { id: string }[]) => void> = [];
    const received: string[] = [];
    const lifecycle = createSoloChampionRequestLifecycle(
      () => new Promise<{ id: string }[]>((resolve) => resolvers.push(resolve)),
      (champions) => received.push(champions[0].id),
    );

    const firstCleanup = lifecycle.start("database-user-id");
    firstCleanup();
    lifecycle.start("database-user-id");
    resolvers[0]([{ id: "stale" }]);
    await Promise.resolve();
    resolvers[1]([{ id: "fresh" }]);
    await Promise.resolve();

    expect(lifecycle.requestedUserIds).toEqual([
      "database-user-id",
      "database-user-id",
    ]);
    expect(received).toEqual(["fresh"]);
  });
});
