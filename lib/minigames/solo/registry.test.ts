import { describe, expect, it } from "vitest";
import { getSoloGameBySlug } from "./registry";

describe("getSoloGameBySlug", () => {
  it("maps each public route slug to its trusted solo-game definition", () => {
    expect(getSoloGameBySlug("typing")?.key).toBe("TYPING");
    expect(getSoloGameBySlug("reaction")?.key).toBe("REACTION");
    expect(getSoloGameBySlug("visual-memory")?.key).toBe("VISUAL_MEMORY");
    expect(getSoloGameBySlug("sequence-memory")?.key).toBe("SEQUENCE_MEMORY");
  });

  it("does not coerce unknown route values into a game type", () => {
    expect(getSoloGameBySlug("TYPING")).toBeUndefined();
    expect(getSoloGameBySlug("not-a-game")).toBeUndefined();
  });
});
