/**
 * Server-side Supabase Realtime broadcast helper.
 *
 * Sends a tiny "something changed" ping on a Realtime topic so subscribed
 * browsers can re-fetch through the normal (Firebase-authed, masked) API.
 * The payload is intentionally empty — Realtime never carries game state,
 * which keeps opponents' secrets (RPS picks, ship positions) off the wire.
 *
 * Uses the stateless HTTP broadcast endpoint rather than opening a websocket,
 * which suits short-lived serverless API route invocations.
 *
 * IMPORTANT: never throws. A failed broadcast must not break the mutation that
 * triggered it — the slow fallback poll on the client still catches the change.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// A hung Realtime endpoint must not stall a caller that awaits broadcast()
// directly — bound the request instead of relying on every call site
// remembering to fire-and-forget it.
const BROADCAST_TIMEOUT_MS = 3000;

type BroadcastMessage = {
  topic: string;
  event?: string;
  payload?: Record<string, unknown>;
};

import { after } from "next/server";

/**
 * Send several invalidations in one Supabase HTTP request. This is important
 * for mutations that affect multiple views (for example a redemption affects
 * rewards, the user's history, admin redemptions, points, and leaderboards).
 */
export async function broadcastMany(messages: BroadcastMessage[]): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || messages.length === 0) return;

  const uniqueMessages = [...new Map(
    messages.map((message) => [
      `${message.topic}\u0000${message.event ?? "update"}`,
      {
        topic: message.topic,
        event: message.event ?? "update",
        payload: message.payload ?? {},
      },
    ]),
  ).values()];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BROADCAST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ messages: uniqueMessages }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Supabase Realtime returned ${response.status}`);
    }
  } catch (err) {
    // Realtime is a freshness accelerator, never a mutation dependency. A
    // normal screen load/resync still recovers the authoritative API state.
    console.error("[realtime] broadcast batch failed:", err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function broadcast(
  topic: string,
  event: string = "update",
  payload: Record<string, unknown> = {},
): Promise<void> {
  await broadcastMany([{ topic, event, payload }]);
}

/**
 * Reliably finish a best-effort broadcast after the mutation response is sent.
 * Next.js maps `after` to Vercel's waitUntil primitive, avoiding both response
 * latency and the unreliable "floating promise after return" pattern.
 */
export function scheduleBroadcast(messages: BroadcastMessage[]): void {
  after(() => broadcastMany(messages));
}
