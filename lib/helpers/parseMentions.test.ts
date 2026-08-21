import { describe, it, expect } from "vitest";
import { extractMentionIds, stripMentionTokens } from "./parseMentions";

const UUID_A = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f601";
const UUID_B = "9c8b7a65-4321-4dcb-9876-0fedcba98765";

describe("extractMentionIds", () => {
  it("returns nothing for empty or absent content", () => {
    expect(extractMentionIds("")).toEqual([]);
    expect(extractMentionIds(null)).toEqual([]);
    expect(extractMentionIds(undefined)).toEqual([]);
    expect(extractMentionIds("no mentions here")).toEqual([]);
  });

  it("extracts a single mention token", () => {
    expect(extractMentionIds(`hey @[Jane Doe|${UUID_A}] look`)).toEqual([UUID_A]);
  });

  it("extracts several and dedupes repeats of the same person", () => {
    const content = `@[Jane Doe|${UUID_A}] and @[Bob|${UUID_B}] and again @[Jane Doe|${UUID_A}]`;
    expect(extractMentionIds(content).sort()).toEqual([UUID_A, UUID_B].sort());
  });

  it("handles names containing spaces, hyphens and apostrophes", () => {
    expect(extractMentionIds(`@[Mary-Jane O'Brien|${UUID_A}]`)).toEqual([UUID_A]);
  });

  it("ignores a bare @name with no token wrapper", () => {
    expect(extractMentionIds("@JaneDoe hello")).toEqual([]);
  });

  it("ignores a malformed token rather than swallowing the rest of the post", () => {
    // Missing the id half, unclosed bracket, and a non-uuid id.
    expect(extractMentionIds("@[Jane Doe] hi")).toEqual([]);
    expect(extractMentionIds(`@[Jane Doe|${UUID_A}`)).toEqual([]);
    expect(extractMentionIds("@[Jane Doe|not-a-uuid]")).toEqual([]);
  });

  it("normalises case so the same id in different case is one recipient", () => {
    const content = `@[A|${UUID_A.toUpperCase()}] @[B|${UUID_A}]`;
    expect(extractMentionIds(content)).toEqual([UUID_A]);
  });

  it("does not let a delimiter inside the name break out of the token", () => {
    // A name containing ] or | must not match — otherwise crafted content
    // could forge a token boundary.
    expect(extractMentionIds(`@[Jane]Doe|${UUID_A}]`)).toEqual([]);
  });
});

describe("stripMentionTokens", () => {
  it("leaves plain text untouched", () => {
    expect(stripMentionTokens("no mentions here")).toBe("no mentions here");
  });

  it("replaces a mention token with plain @Name text", () => {
    expect(stripMentionTokens(`hey @[Jane Doe|${UUID_A}] look`)).toBe("hey @Jane Doe look");
  });

  it("replaces several tokens in one string", () => {
    const content = `@[Jane Doe|${UUID_A}] and @[Bob|${UUID_B}]`;
    expect(stripMentionTokens(content)).toBe("@Jane Doe and @Bob");
  });

  it("leaves a malformed token as-is rather than mangling it", () => {
    expect(stripMentionTokens("@[Jane Doe] hi")).toBe("@[Jane Doe] hi");
  });
});
