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

export async function broadcast(
  topic: string,
  event: string = "update",
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload }],
      }),
    });
  } catch (err) {
    // Swallow — broadcast is best-effort; the fallback poll covers misses.
    console.error(`[realtime] broadcast to "${topic}" failed:`, err);
  }
}
