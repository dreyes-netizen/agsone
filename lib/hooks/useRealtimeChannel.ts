"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browserClient";

/**
 * Subscribe to a Supabase Realtime broadcast topic and run `onMessage` whenever
 * an "update" ping arrives. Used as a real-time trigger to re-fetch fresh data
 * through the normal API (the ping itself carries no data).
 *
 * Pass `topic = null` to subscribe to nothing (e.g. before a session id or the
 * current user is known). The callback is held in a ref so changing its
 * identity between renders does not tear down and rebuild the subscription.
 */
export function useRealtimeChannel(topic: string | null, onMessage: () => void) {
  const cb = useRef(onMessage);
  cb.current = onMessage;

  useEffect(() => {
    if (!topic) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "update" }, () => cb.current())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topic]);
}
