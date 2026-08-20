import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ─── Scopes ─────────────────────────────────────────────────────────────────
// Each scope gets its own independent bucket (own Redis prefix / own in-memory
// map) so, e.g., a user's AI assistant usage never counts against their
// points-award limit or vice versa. Add a new scope here rather than reusing
// "assistant" for an unrelated route.
const SCOPE_CONFIG = {
  assistant: { limit: 20, window: "1 h" as const, windowMs: 60 * 60 * 1000 },
  // Sensitive write endpoints (points award/deduct, redemptions, bulk
  // uploads): loose enough for legitimate rapid admin work, tight enough to
  // blunt scripted abuse from a valid-but-malicious account.
  write: { limit: 30, window: "5 m" as const, windowMs: 5 * 60 * 1000 },
  // Ranked Arcade starts and finishes have their own bucket so rapid play
  // cannot consume capacity intended for administrative writes.
  arcade: { limit: 30, window: "5 m" as const, windowMs: 5 * 60 * 1000 },
  // Throttles notifications that fire on a high-frequency action rather than a
  // user request — currently "your turn" in turn-based minigames, where a fast
  // exchange would otherwise notify on every single move. Keyed per session per
  // recipient, not per user, so two concurrent games don't starve each other.
  // Deliberately not a hard cap on anything the user can see: exceeding it
  // silently drops the notification, and Realtime still updates the open board.
  notify: { limit: 2, window: "5 m" as const, windowMs: 5 * 60 * 1000 },
} satisfies Record<string, { limit: number; window: `${number} ${"s" | "m" | "h" | "d"}`; windowMs: number }>;

export type RateLimitScope = keyof typeof SCOPE_CONFIG;

// ─── Upstash Redis (production) ───────────────────────────────────────────────
// Uses atomic sliding-window counters that survive serverless cold starts.
// Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured (dev/local).

const limiters = {} as Record<RateLimitScope, Ratelimit>;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  for (const scope of Object.keys(SCOPE_CONFIG) as RateLimitScope[]) {
    const cfg = SCOPE_CONFIG[scope];
    limiters[scope] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
      prefix: `ags_ratelimit_${scope}`,
    });
  }
}

// ─── In-memory fallback (development / missing env vars) ──────────────────────
// Resets on cold start — only used locally. Do not rely on in production.

type Window = { count: number; windowStart: number };

// Derived from SCOPE_CONFIG rather than listed by hand, so adding a scope above
// cannot leave this map missing an entry (which it silently did until the
// compiler caught it).
const stores = Object.fromEntries(
  (Object.keys(SCOPE_CONFIG) as RateLimitScope[]).map((scope) => [scope, new Map<string, Window>()]),
) as Record<RateLimitScope, Map<string, Window>>;

function inMemoryCheck(scope: RateLimitScope, userId: string): { allowed: boolean; remaining: number } {
  const cfg = SCOPE_CONFIG[scope];
  const store = stores[scope];
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now - entry.windowStart > cfg.windowMs) {
    store.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: cfg.limit - 1 };
  }
  if (entry.count >= cfg.limit) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: cfg.limit - entry.count };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(
  userId: string,
  scope: RateLimitScope = "assistant"
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = limiters[scope];
  if (limiter) {
    const result = await limiter.limit(userId);
    return { allowed: result.success, remaining: result.remaining };
  }
  return inMemoryCheck(scope, userId);
}
