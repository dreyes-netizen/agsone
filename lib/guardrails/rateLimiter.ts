import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ─── Upstash Redis (production) ───────────────────────────────────────────────
// Uses atomic sliding-window counters that survive serverless cold starts.
// Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured (dev/local).

let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "ags_ratelimit",
  });
}

// ─── In-memory fallback (development / missing env vars) ──────────────────────
// Resets on cold start — only used locally. Do not rely on in production.

type Window = { count: number; windowStart: number };
const store = new Map<string, Window>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;

function inMemoryCheck(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }
  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (ratelimit) {
    const result = await ratelimit.limit(userId);
    return { allowed: result.success, remaining: result.remaining };
  }
  return inMemoryCheck(userId);
}
