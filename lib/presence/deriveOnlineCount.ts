/**
 * Pure heartbeat-map -> online-count derivation. Shared by the in-memory dev
 * fallback in onlinePresence.ts; the Redis-backed path counts live keys
 * directly since Redis TTLs handle staleness there. Kept here, unit-tested
 * in isolation, so the counting rule has one definition regardless of which
 * store computes it.
 */
export function deriveOnlineCount(
  lastSeenByUser: Record<string, number>,
  nowMs: number,
  staleAfterMs: number,
): number {
  return Object.values(lastSeenByUser).filter((lastSeen) => nowMs - lastSeen <= staleAfterMs).length;
}
