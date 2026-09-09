import { describe, expect, it, vi } from "vitest";

// Mock the Firebase client module since it can't initialize in Node environment
vi.mock("@/lib/firebase/client", () => ({
  auth: {},
}));

import { buildLinkToken } from "./useFeedActions";

describe("buildLinkToken", () => {
  it("wraps the url with the label as markdown-style link text", () => {
    expect(buildLinkToken("https://example.com/survey", "Complete the survey here"))
      .toBe("[Complete the survey here](https://example.com/survey)");
  });

  it("returns the bare url when no label is given", () => {
    expect(buildLinkToken("https://example.com", "")).toBe("https://example.com");
  });

  it("returns the bare url when the label is only whitespace", () => {
    expect(buildLinkToken("https://example.com", "   ")).toBe("https://example.com");
  });

  it("prepends https:// to a url with no protocol", () => {
    expect(buildLinkToken("example.com", "")).toBe("https://example.com");
  });

  it("does not double-prepend https:// when already present", () => {
    expect(buildLinkToken("http://example.com", "")).toBe("http://example.com");
  });

  it("trims surrounding whitespace from the url and label", () => {
    expect(buildLinkToken("  https://example.com  ", "  Survey  "))
      .toBe("[Survey](https://example.com)");
  });

  it("strips a stray ] from the label so it can't prematurely close the token", () => {
    expect(buildLinkToken("https://example.com", "click here]"))
      .toBe("[click here](https://example.com)");
  });
});
