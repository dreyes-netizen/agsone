import { describe, it, expect } from "vitest";
import { videoPosterUrl, isOwnCloudinaryVideoUrl } from "./videoUrl";

const CLOUD = "test-cloud";
const valid = `https://res.cloudinary.com/${CLOUD}/video/upload/q_auto,w_720,c_limit/v1712345678/abc123.mp4`;

describe("videoPosterUrl", () => {
  it("asks for the first frame as a JPEG", () => {
    expect(videoPosterUrl(valid)).toBe(
      `https://res.cloudinary.com/${CLOUD}/video/upload/so_0/q_auto,w_720,c_limit/v1712345678/abc123.jpg`,
    );
  });

  it("replaces any source extension, not just mp4", () => {
    expect(videoPosterUrl(`https://res.cloudinary.com/${CLOUD}/video/upload/v1/clip.mov`)).toMatch(/\.jpg$/);
    expect(videoPosterUrl(`https://res.cloudinary.com/${CLOUD}/video/upload/v1/clip.webm`)).toMatch(/\.jpg$/);
  });

  it("leaves a URL without an extension otherwise intact", () => {
    const noExt = `https://res.cloudinary.com/${CLOUD}/video/upload/v1/clip`;
    expect(videoPosterUrl(noExt)).toBe(`https://res.cloudinary.com/${CLOUD}/video/upload/so_0/v1/clip`);
  });
});

describe("isOwnCloudinaryVideoUrl", () => {
  it("accepts a video delivery URL on our own cloud", () => {
    expect(isOwnCloudinaryVideoUrl(valid, CLOUD)).toBe(true);
  });

  it("rejects another Cloudinary account's cloud", () => {
    expect(isOwnCloudinaryVideoUrl(`https://res.cloudinary.com/someone-else/video/upload/v1/x.mp4`, CLOUD)).toBe(false);
  });

  it("rejects a lookalike host that merely starts with ours", () => {
    // The check must be on the parsed hostname, not a string prefix — otherwise
    // an attacker-controlled domain sails through.
    expect(isOwnCloudinaryVideoUrl(`https://res.cloudinary.com.evil.test/${CLOUD}/video/upload/v1/x.mp4`, CLOUD)).toBe(false);
  });

  it("rejects a non-video resource path", () => {
    expect(isOwnCloudinaryVideoUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/x.jpg`, CLOUD)).toBe(false);
    expect(isOwnCloudinaryVideoUrl(`https://res.cloudinary.com/${CLOUD}/raw/upload/v1/x.bin`, CLOUD)).toBe(false);
  });

  it("rejects plaintext http", () => {
    expect(isOwnCloudinaryVideoUrl(`http://res.cloudinary.com/${CLOUD}/video/upload/v1/x.mp4`, CLOUD)).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isOwnCloudinaryVideoUrl("javascript:alert(1)", CLOUD)).toBe(false);
    expect(isOwnCloudinaryVideoUrl("data:video/mp4;base64,AAAA", CLOUD)).toBe(false);
  });

  it("rejects unparseable input", () => {
    expect(isOwnCloudinaryVideoUrl("not a url", CLOUD)).toBe(false);
    expect(isOwnCloudinaryVideoUrl("", CLOUD)).toBe(false);
  });

  it("fails closed when the cloud name is not configured", () => {
    expect(isOwnCloudinaryVideoUrl(valid, undefined)).toBe(false);
  });
});
