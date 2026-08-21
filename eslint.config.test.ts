import { ESLint } from "eslint";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(dirname, "eslint.config.mjs");

function createEslint() {
  return new ESLint({
    cwd: dirname,
    overrideConfigFile: configPath,
  });
}

describe("eslint config", () => {
  it("ignores nested worktree files", async () => {
    const eslint = createEslint();

    await expect(
      eslint.isPathIgnored(".worktrees/other-branch/app/example/page.tsx"),
    ).resolves.toBe(true);
  });

  it("still lints normal repo files", async () => {
    const eslint = createEslint();

    await expect(eslint.isPathIgnored("app/layout.tsx")).resolves.toBe(false);
  });
});
