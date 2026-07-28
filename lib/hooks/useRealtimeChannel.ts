"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browserClient";
import { subscribeResync, pinRealtimeAlive } from "@/lib/realtime/lifecycle";

type Options = {
  /**
   * Exempt this channel from the tab-hidden idle disconnect (e.g. an active
   * game you want to keep receiving moves on regardless of focus). Off by
   * default — most channels are fine to suspend while hidden and resync on
   * return. See lib/realtime/lifecycle.ts.
   */
  keepAliveWhenHidden?: boolean;
};

/**
 * Subscribe to a Supabase Realtime broadcast topic and run `onMessage` whenever
 * an "update" ping arrives. Used as a real-time trigger to re-fetch fresh data
 * through the normal API (the ping itself carries no data).
 *
 * Pass `topic = null` to subscribe to nothing (e.g. before a session id or the
 * current user is known). The callback is held in a ref so changing its
 * identity between renders does not tear down and rebuild the subscription.
 *
 * To save Realtime connection quota, the underlying socket (shared by every
 * channel) is suspended after the tab has been hidden for a while — see
 * lib/realtime/tabState.ts. This channel is NOT torn down for that (see
 * lib/realtime/lifecycle.ts for why removeChannel is the wrong tool here).
 * Instead, on wake `onMessage` fires once to resync, since anything
 * broadcast while disconnected was lost for good.
 */
export function useRealtimeChannel(
  topic: string | null,
  onMessage: () => void,
  options: Options = {},
) {
  const cb = useRef(onMessage);
  cb.current = onMessage;
  const keepAliveWhenHidden = options.keepAliveWhenHidden ?? false;

  useEffect(() => {
    if (!topic) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "update" }, () => cb.current())
      .subscribe();

    const unsubscribeResync = subscribeResync(() => cb.current());
    const unpin = keepAliveWhenHidden ? pinRealtimeAlive() : null;

    return () => {
      unsubscribeResync();
      unpin?.();
      supabase.removeChannel(channel);
    };
  }, [topic, keepAliveWhenHidden]);
}
