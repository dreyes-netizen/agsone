import { describe, expect, it } from "vitest";
import { hasAccountTagTrigger } from "./useAccountTagInput";

describe("hasAccountTagTrigger", () => {
  it("is true right after a bare #", () => {
    const value = "Great work on #";
    expect(hasAccountTagTrigger(value, value.length)).toBe(true);
  });

  it("is true while typing a partial account name, spaces included", () => {
    // Account names can contain spaces (e.g. "Flyland Recovery"), so a space
    // must not break the query -- mirrors useMentionInput's own @ behavior
    // ("Allow spaces in names; stop only at another @ or an already-resolved
    // mention").
    const value = "Great work on #Flyland Rec";
    expect(hasAccountTagTrigger(value, value.length)).toBe(true);
  });

  it("is false with no # typed", () => {
    const value = "Great work today";
    expect(hasAccountTagTrigger(value, value.length)).toBe(false);
  });

  it("is false once the tag is already resolved to a token with nothing further typed", () => {
    const value = "Great work on #[Flyland|abc123]";
    expect(hasAccountTagTrigger(value, value.length)).toBe(false);
  });

  it("restarts the query at a second #, not the first", () => {
    const value = "#EMB or #Fly";
    expect(hasAccountTagTrigger(value, value.length)).toBe(true);
  });

  it("is false once the run since the last # exceeds the 40-character cap", () => {
    // Mirrors useMentionInput's own guard against an unmatched "#" early in a
    // long post leaving the dropdown open over everything typed afterwards.
    const value = "#" + "x".repeat(41);
    expect(hasAccountTagTrigger(value, value.length)).toBe(false);
  });

  it("is false when the cursor sits before the #", () => {
    const value = "Great work on #Flyland";
    expect(hasAccountTagTrigger(value, value.indexOf("#"))).toBe(false);
  });
});
