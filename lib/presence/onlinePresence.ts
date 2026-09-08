import { Redis } from "@upstash/redis";
import { deriveOnlineCount } from "@/lib/presence/deriveOnlineCount";

// A heartbeat older than this is treated as offline — 2x the client's
// HEARTBEAT_INTERVAL_MS (see lib/hooks/useOnlinePresence.ts) tolerates one
// missed beat (a slow network tick, a tab not yet paused) without flickering
// someone in and out of the count.
const STALE_AFTER_MS = 90_000;
const STALE_AFTER_SECONDS = STALE_AFTER_MS / 1000;
const REDIS_KEY_PREFIX = "ags_presence:";

// Mirrors lib/guardrails/rateLimiter.ts's existing Redis/in-memory fallback
// pattern exactly: Upstash in production, an in-memory Map in local dev when
// the env vars aren't configured.
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const inMemoryHeartbeats = new Map<string, number>();

export async function recordHeartbeat(userId: string): Promise<void> {
  if (redis) {
    await redis.set(`${REDIS_KEY_PREFIX}${userId}`, 1, { ex: STALE_AFTER_SECONDS });
    return;
  }
  inMemoryHeartbeats.set(userId, Date.now());
}

export async function getOnlineCount(): Promise<number> {
  if (redis) {
    // KEYS is O(n) over the matched keyspace, which is fine at this app's
    // scale (one internal company's active employees, not a large
    // multi-tenant keyspace) — do not reuse this pattern for a larger one.
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
    return keys.length;
  }
  const snapshot = Object.fromEntries(inMemoryHeartbeats);
  return deriveOnlineCount(snapshot, Date.now(), STALE_AFTER_MS);
}
