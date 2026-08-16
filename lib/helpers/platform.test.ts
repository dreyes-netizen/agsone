import { describe, it, expect } from "vitest";
import { isIOSUserAgent } from "./platform";

// Real user-agent strings, because the whole bug was a plausible-looking
// regex that happened not to match the device we cared about.
const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipadLegacy:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  // iPadOS 13+ default: identifies as Macintosh.
  ipadModern:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

describe("isIOSUserAgent", () => {
  it("detects iPhone", () => {
    expect(isIOSUserAgent(UA.iphone, 5)).toBe(true);
  });

  it("detects a pre-iPadOS-13 iPad from the user agent alone", () => {
    expect(isIOSUserAgent(UA.ipadLegacy, 5)).toBe(true);
  });

  it("detects a modern iPad that reports itself as Macintosh", () => {
    // The regression this helper exists for: identical UA to a Mac, told apart
    // only by touch points.
    expect(isIOSUserAgent(UA.ipadModern, 5)).toBe(true);
  });

  it("does not mistake a real Mac for an iPad", () => {
    expect(isIOSUserAgent(UA.macSafari, 0)).toBe(false);
  });

  it("does not treat a touchscreen Mac-like UA with one touch point as iOS", () => {
    // maxTouchPoints of 1 is not an iPad; the threshold is deliberately > 1.
    expect(isIOSUserAgent(UA.macSafari, 1)).toBe(false);
  });

  it("returns false for Android and Windows", () => {
    expect(isIOSUserAgent(UA.androidChrome, 5)).toBe(false);
    expect(isIOSUserAgent(UA.windowsChrome, 0)).toBe(false);
  });

  it("excludes the legacy Windows Phone UA that also contained iPhone", () => {
    expect(isIOSUserAgent(UA.iphone, 5, true)).toBe(false);
  });
});
