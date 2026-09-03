// Pure helpers for Cloudinary video URLs. Kept separate from upload.ts because
// that module is browser-only (it fetches /api/upload/sign) while these are
// needed on the server too — the feed API validates submitted URLs with them.

/**
 * Derives a poster image (still frame) from a Cloudinary video URL by asking
 * for the first frame as a JPEG — `so_0` is the seek offset in seconds, and
 * swapping the file extension changes the delivered format.
 *
 * This is what keeps video affordable: scrolling the feed downloads a ~30 KB
 * still per post instead of streaming video bytes, and the video itself is
 * only fetched when someone actually presses play.
 */
export function videoPosterUrl(videoUrl: string): string {
  return videoUrl
    .replace("/upload/", "/upload/so_0/")
    .replace(/\.[a-zA-Z0-9]+$/, ".jpg");
}

/**
 * True only for a video delivery URL on *our own* Cloudinary cloud.
 *
 * The stored URL ends up in a `<video src>`, so it cannot be trusted just
 * because it parsed as a URL: the value arrives from the client and a
 * forged one would let a post embed media from anywhere, or point the feed
 * at a URL we never uploaded. Checking the origin and the `/video/upload/`
 * path segment means a post can only ever reference something that actually
 * went through our signed upload route.
 */
export function isOwnCloudinaryVideoUrl(url: string, cloudName: string | undefined): boolean {
  if (!cloudName) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === "res.cloudinary.com" &&
    parsed.pathname.startsWith(`/${cloudName}/video/upload/`)
  );
}
