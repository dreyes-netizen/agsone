import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TypingGame } from "./TypingGame";

describe("TypingGame", () => {
  it("tells ranked players to restart from the beginning if they finish early", () => {
    const html = renderToStaticMarkup(
      createElement(TypingGame, {
        challenge: {
          passageId: "solo-typing-001",
          passageText: "Practice text that is long enough for a static render check.",
          durationMs: 60_000,
        },
        mode: "ranked",
        onComplete: () => undefined,
      }),
    );

    expect(html).toContain("If you finish early, continue again from the start until time expires.");
  });
});
