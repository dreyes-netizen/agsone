import { describe, expect, it } from "vitest";
import picomatch from "picomatch";
import config from "./vitest.config.mts";

function isDiscoveredTestPath(path: string) {
  const normalizedPath = path.replaceAll("\\", "/");
  const include = config.test?.include ?? [];
  const exclude = config.test?.exclude ?? [];

  return (
    picomatch.isMatch(normalizedPath, include) &&
    !picomatch.isMatch(normalizedPath, exclude)
  );
}

describe("vitest config", () => {
  it("excludes repo-relative nested worktree test files from discovery", () => {
    expect(
      isDiscoveredTestPath(
        ".worktrees/ags-arcade-solo-v1/lib/minigames/solo/reaction.test.ts",
      ),
    ).toBe(false);
  });

  it("keeps normal repo test files discoverable", () => {
    expect(isDiscoveredTestPath("lib/minigames/solo/reaction.test.ts")).toBe(true);
  });
});
