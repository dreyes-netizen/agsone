"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browserClient";
import { realtimeTopics } from "@/lib/realtime/topics";
import { useAuth } from "@/lib/auth/AuthProvider";
import { derivePresenceCount } from "@/lib/hooks/derivePresenceCount";

/**
 * Live count of distinct people currently using the app, via a Supabase
 * Realtime Presence channel (a synced roster, not a broadcast ping — see
 * lib/realtime/topics.ts). Keyed by user id so multiple tabs from the same
 * person collapse to one roster entry.
 *
 * Rides the existing shared-socket lifecycle (lib/realtime/lifecycle.ts):
 * when a tab goes hidden past the idle grace period, the socket disconnects
 * and this user drops out of every other client's count automatically; on
 * reconnect the channel auto-rejoins and re-tracks. No new lifecycle code
 * needed — deliberately does NOT call pinRealtimeAlive().
 *
 * Returns null until the first presence sync arrives, so callers can avoid
 * rendering a misleading "0 online" during the brief connect window.
 */
export function useOnlinePresence(): { count: number | null } {
  const { dbUser } = useAuth();
  const userId = dbUser?.id;
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = getBrowserSupabase();
    const channel = supabase.channel(realtimeTopics.onlinePresence, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(derivePresenceCount(channel.presenceState()));
      })
      .subscribe((status) => {
        // Re-track on every (re)join, not just the first — this is what
        // survives the shared socket's idle-hidden suspend/resume cycle.
        // Mirrors lifecycle.ts's own "resync on wake" idiom for broadcast
        // channels; this is the Presence equivalent.
        if (status === "SUBSCRIBED") {
          channel.track({});
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { count };
}
