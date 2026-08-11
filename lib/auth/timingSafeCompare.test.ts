import { describe, it, expect } from "vitest";
import { timingSafeCompare } from "./timingSafeCompare";

describe("timingSafeCompare", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeCompare("shared-secret-123", "shared-secret-123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeCompare("shared-secret-123", "shared-secret-124")).toBe(false);
  });

  it("returns false for strings of different lengths without throwing", () => {
    expect(timingSafeCompare("short", "a-much-longer-secret-value")).toBe(false);
  });

  it("returns false when compared against an empty string", () => {
    expect(timingSafeCompare("secret", "")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeCompare("", "")).toBe(true);
  });
});
