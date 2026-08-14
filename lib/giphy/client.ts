"use client";

/**
 * Client-side GIPHY wrapper. GIPHY's API terms require Search/Trending calls
 * to be made directly from the browser (proxying through our own server is
 * explicitly disallowed), so this deliberately has no server-side
 * counterpart — unlike the rest of this app's external integrations (Groq,
 * Cloudinary), the API key here is a browser-visible, rate-limited public
 * key (NEXT_PUBLIC_GIPHY_API_KEY), the same trust model as this app's
 * existing Firebase/Cloudinary public keys.
 *
 * We only ever resolve GIFs by id at render time (never store or trust a
 * media URL from anywhere but a live GIPHY response) — see
 * SocialComment.gifProvider/gifId in schema.prisma.
 */

const API_BASE = "https://api.giphy.com/v1/gifs";
// Strictest content rating GIPHY offers — appropriate for a company-wide tool.
const RATING = "g";

export type GifResult = {
  id: string;
  provider: "giphy";
  title: string;
  altText: string;
  width: number;
  height: number;
  /** Animated rendition, capped to a reasonable comment display size. */
  animatedUrl: string;
  /** Static rendition, used under prefers-reduced-motion. */
  stillUrl: string;
  /** Small rendition for the search-results grid. */
  thumbUrl: string;
};

export type GifFetchResult =
  | { ok: true; results: GifResult[] }
  | { ok: false; reason: "unconfigured" | "error" };

type GiphyRendition = { url: string; width: string; height: string };
type GiphyGif = {
  id: string;
  title?: string;
  alt_text?: string;
  images: {
    downsized?: GiphyRendition;
    downsized_still?: GiphyRendition;
    original: GiphyRendition;
    original_still?: GiphyRendition;
    fixed_width_small: GiphyRendition;
  };
};

// Session-lifetime only (cleared on reload) — avoids re-fetching the same
// GIF's metadata across multiple mounted comment lists (feed card + media
// viewer sidebar). Not persisted anywhere, so this doesn't run afoul of
// GIPHY's "don't cache/store media" restriction on integrations.
const resultCache = new Map<string, GifResult>();

function normalize(g: GiphyGif): GifResult {
  const anim = g.images.downsized ?? g.images.original;
  const still = g.images.downsized_still ?? g.images.original_still ?? anim;
  const result: GifResult = {
    id: g.id,
    provider: "giphy",
    title: g.title || "GIF",
    altText: g.alt_text || g.title || "GIF",
    width: Number(anim.width) || 0,
    height: Number(anim.height) || 0,
    animatedUrl: anim.url,
    stillUrl: still.url,
    thumbUrl: g.images.fixed_width_small.url,
  };
  resultCache.set(result.id, result);
  return result;
}

function apiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  return key && key.length > 0 ? key : null;
}

async function call(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<GifFetchResult> {
  const key = apiKey();
  if (!key) return { ok: false, reason: "unconfigured" };
  const qs = new URLSearchParams({ api_key: key, rating: RATING, ...params });
  try {
    const res = await fetch(`${API_BASE}${path}?${qs.toString()}`, { signal });
    if (!res.ok) return { ok: false, reason: "error" };
    const json = await res.json();
    const data: GiphyGif[] = Array.isArray(json.data) ? json.data : [];
    return { ok: true, results: data.map(normalize) };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export function searchGifs(query: string, signal?: AbortSignal): Promise<GifFetchResult> {
  return call("/search", { q: query, limit: "24", lang: "en" }, signal);
}

export function trendingGifs(signal?: AbortSignal): Promise<GifFetchResult> {
  return call("/trending", { limit: "24" }, signal);
}

/** Seed the session cache with an already-fetched result (e.g. right after
 * picker selection) so the comment that references it renders instantly
 * instead of waiting on a redundant round trip. */
export function seedGifCache(gif: GifResult): void {
  resultCache.set(gif.id, gif);
}

/**
 * Batch-resolves ids to renderable GIF data — one network call for however
 * many ids aren't already cached, regardless of how many comments reference
 * them. Returns every requested id explicitly (null = not found/unavailable)
 * so the caller can tell "still loading" (id absent from the map) apart from
 * "confirmed gone" (null).
 */
export async function getGifsByIds(
  ids: string[],
  signal?: AbortSignal
): Promise<Record<string, GifResult | null>> {
  const missing = ids.filter((id) => !resultCache.has(id));
  if (missing.length > 0) {
    const key = apiKey();
    if (key) {
      try {
        const qs = new URLSearchParams({ api_key: key, rating: RATING, ids: missing.join(",") });
        const res = await fetch(`${API_BASE}?${qs.toString()}`, { signal });
        if (res.ok) {
          const json = await res.json();
          const data: GiphyGif[] = Array.isArray(json.data) ? json.data : [];
          data.forEach(normalize);
        }
      } catch {
        // Leave unresolved ids out of resultCache — mapped to null below.
      }
    }
  }
  const out: Record<string, GifResult | null> = {};
  for (const id of ids) out[id] = resultCache.get(id) ?? null;
  return out;
}
