import { describe, expect, it } from "vitest";
import config from "./vitest.config.mts";

describe("vitest config", () => {
  it("excludes nested git worktrees from test discovery", () => {
    expect(config.test?.exclude).toContain(".worktrees/**");
  });
});
