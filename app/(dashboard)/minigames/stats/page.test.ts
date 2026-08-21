import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: true, dbUser: null }),
}));
vi.mock("@/lib/hooks/useApiClient", () => ({
  useApiClient: () => ({ apiFetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/useRealtimeChannel", () => ({
  useRealtimeChannel: vi.fn(),
}));

import {
  canLoadMultiplayerStats,
  getMinigameStatsTabFromKey,
  MinigameStatsTabPanel,
  MinigameStatsTabs,
} from "./page";

describe("canLoadMultiplayerStats", () => {
  it("keeps W/L/D requests idle while the Solo view is selected", () => {
    expect(canLoadMultiplayerStats("solo", false, true)).toBe(false);
  });

  it("allows the existing W/L/D requests only for an authenticated Multiplayer view", () => {
    expect(canLoadMultiplayerStats("multiplayer", false, true)).toBe(true);
    expect(canLoadMultiplayerStats("multiplayer", true, true)).toBe(false);
    expect(canLoadMultiplayerStats("multiplayer", false, false)).toBe(false);
  });

  it("renders an accessible tab and panel relationship with roving tab stops", () => {
    const html = renderToStaticMarkup(
      createElement(MinigameStatsTabs, { view: "solo", onChange: vi.fn() }),
    );

    expect(html).toContain('id="minigame-stats-multiplayer-tab"');
    expect(html).toContain('aria-controls="minigame-stats-multiplayer-panel"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('id="minigame-stats-solo-tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="0"');

    const panelHtml = renderToStaticMarkup(
      createElement(MinigameStatsTabPanel, { view: "solo" }, "Solo content"),
    );
    expect(panelHtml).toContain('id="minigame-stats-solo-panel"');
    expect(panelHtml).toContain('aria-labelledby="minigame-stats-solo-tab"');
  });

  it("moves the active tab with arrow, Home, and End keys", () => {
    expect(getMinigameStatsTabFromKey("multiplayer", "ArrowRight")).toBe(
      "solo",
    );
    expect(getMinigameStatsTabFromKey("solo", "ArrowLeft")).toBe("multiplayer");
    expect(getMinigameStatsTabFromKey("solo", "Home")).toBe("multiplayer");
    expect(getMinigameStatsTabFromKey("multiplayer", "End")).toBe("solo");
    expect(getMinigameStatsTabFromKey("solo", "Enter")).toBeNull();
  });
});
