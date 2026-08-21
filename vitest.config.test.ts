import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const picomatch = require("picomatch") as {
  isMatch(input: string, patterns: readonly string[]): boolean;
};

type VitestConfig = {
  test?: {
    include?: string[];
    exclude?: string[];
  };
};

async function loadConfig() {
  const configUrl = new URL("./vitest.config.mts", import.meta.url).href;
  const module = (await import(configUrl)) as { default: VitestConfig };

  return module.default;
}

async function isDiscoveredTestPath(path: string) {
  const config = await loadConfig();
  const normalizedPath = path.replaceAll("\\", "/");
  const include = config.test?.include ?? [];
  const exclude = config.test?.exclude ?? [];

  return (
    picomatch.isMatch(normalizedPath, include) &&
    !picomatch.isMatch(normalizedPath, exclude)
  );
}

describe("vitest config", () => {
  it("excludes repo-relative nested worktree test files from discovery", async () => {
    expect(
      await isDiscoveredTestPath(
        ".worktrees/ags-arcade-solo-v1/lib/minigames/solo/reaction.test.ts",
      ),
    ).toBe(false);
  });

  it("keeps normal repo test files discoverable", async () => {
    expect(await isDiscoveredTestPath("lib/minigames/solo/reaction.test.ts")).toBe(
      true,
    );
  });
});
