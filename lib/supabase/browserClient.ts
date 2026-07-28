"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client for Realtime subscriptions only.
 *
 * Uses the public anon key (safe to ship to the browser). We do NOT use
 * Supabase Auth here — this app authenticates with Firebase — so session
 * persistence is disabled. The client is created once (module singleton) so
 * we don't open a new websocket on every component render.
 */

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        // Dev-only: surfaces "transport: close", "deferred disconnect
        // scheduled in ...ms", "Not reconnecting as page is hidden!" etc. —
        // useful for verifying the tab-hidden idle disconnect actually
        // fires (see lib/realtime/lifecycle.ts). No-op in production.
        ...(process.env.NODE_ENV !== "production" && {
          logger: (kind: string, msg: string, data?: unknown) =>
            console.debug(`[realtime:${kind}] ${msg}`, data ?? ""),
        }),
      },
    },
  );
  return client;
}
