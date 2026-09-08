/**
 * Pure roster -> count derivation for the online-users Presence channel.
 * Extracted from useOnlinePresence so it's unit-testable without a real
 * Supabase Realtime socket (Vitest's Node environment can't exercise one).
 */
export function derivePresenceCount(presenceState: Record<string, unknown[]>): number {
  return Object.keys(presenceState).length;
}
