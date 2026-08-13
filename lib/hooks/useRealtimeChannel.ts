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
  /** Coalesce bursts of related invalidations into one authenticated refetch. */
  debounceMs?: number;
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
  useRealtimeChannels(topic ? [topic] : [], onMessage, options);
}

/**
 * Subscribe one screen to several scopes while sharing a single coalesced
 * refresh callback. All channels still use the one module-level Supabase
 * client/WebSocket.
 */
export function useRealtimeChannels(
  topics: readonly (string | null)[],
  onMessage: () => void,
  options: Options = {},
) {
  const cb = useRef(onMessage);
  useEffect(() => {
    cb.current = onMessage;
  });
  const keepAliveWhenHidden = options.keepAliveWhenHidden ?? false;
  const debounceMs = options.debounceMs ?? 0;
  const topicKey = [...new Set(topics.filter((topic): topic is string => !!topic))]
    .sort()
    .join("\u0000");

  useEffect(() => {
    if (!topicKey) return;

    const supabase = getBrowserSupabase();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (debounceMs <= 0) {
        cb.current();
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        cb.current();
      }, debounceMs);
    };
    const channels = topicKey.split("\u0000").map((topic) => {
      let subscribedOnce = false;
      return supabase
        .channel(topic)
        .on("broadcast", { event: "update" }, notify)
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          // A reconnect can miss broadcasts sent while the socket was down.
          // The first SUBSCRIBED is covered by the screen's initial load; each
          // later one performs a single coalesced authoritative resync.
          if (subscribedOnce) notify();
          subscribedOnce = true;
        });
    });

    const unsubscribeResync = subscribeResync(notify);
    const unpin = keepAliveWhenHidden ? pinRealtimeAlive() : null;

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeResync();
      unpin?.();
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [topicKey, keepAliveWhenHidden, debounceMs]);
}
