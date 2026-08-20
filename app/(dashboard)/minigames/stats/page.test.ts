import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => ({ user: null, loading: true, dbUser: null }) }));
vi.mock("@/lib/hooks/useApiClient", () => ({ useApiClient: () => ({ apiFetch: vi.fn() }) }));
vi.mock("@/lib/hooks/useRealtimeChannel", () => ({ useRealtimeChannel: vi.fn() }));

import { canLoadMultiplayerStats } from "./page";

describe("canLoadMultiplayerStats", () => {
  it("keeps W/L/D requests idle while the Solo view is selected", () => {
    expect(canLoadMultiplayerStats("solo", false, true)).toBe(false);
  });

  it("allows the existing W/L/D requests only for an authenticated Multiplayer view", () => {
    expect(canLoadMultiplayerStats("multiplayer", false, true)).toBe(true);
    expect(canLoadMultiplayerStats("multiplayer", true, true)).toBe(false);
    expect(canLoadMultiplayerStats("multiplayer", false, false)).toBe(false);
  });
});
