/**
 * Platform detection for the PWA install and push flows.
 *
 * Both of those need the same two answers — "is this an Apple mobile device?"
 * and "are we running as an installed app?" — and they must agree, because
 * together they decide whether a user is shown a working push toggle or
 * instructions to install first. Keeping one implementation is the point:
 * these were duplicated, and both copies carried the same bug.
 */

/**
 * True for iPhone, iPod and iPad.
 *
 * The obvious `/iPad|iPhone|iPod/` test is not enough: **iPadOS 13+ Safari
 * reports itself as `Macintosh`** by default (desktop-class browsing), so an
 * iPad is indistinguishable from a Mac by user-agent alone. The standard
 * workaround is `maxTouchPoints` — a real Mac reports 0, an iPad reports 5.
 *
 * Getting this wrong is not cosmetic. An undetected iPad is offered a push
 * toggle that cannot work (iPadOS only permits Web Push in an installed app)
 * and is never shown the instructions that would let it work, since Safari
 * fires no `beforeinstallprompt` either.
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    // Excludes the legacy IE-on-Windows-Phone UA, which also matched iPhone.
    return !("MSStream" in window);
  }

  // iPadOS masquerading as macOS. Touch points are the distinguishing signal.
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

/** True when running as an installed app rather than in browser chrome. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates display-mode and uses this non-standard flag instead.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Testable core of {@link isIOSDevice}, so the UA strings can be asserted
 * without a DOM. Kept separate because navigator is not injectable.
 */
export function isIOSUserAgent(userAgent: string, maxTouchPoints: number, hasMSStream = false): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return !hasMSStream;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
