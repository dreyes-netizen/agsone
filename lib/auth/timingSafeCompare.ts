import { timingSafeEqual } from "crypto";

// Plain !== on a shared secret is vulnerable to a timing side-channel over
// many requests. Guards against a length mismatch short-circuiting before
// the constant-time compare even runs.
export function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
