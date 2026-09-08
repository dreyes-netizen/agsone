"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { realtimeTopics } from "@/lib/realtime/topics";

// Matches STALE_AFTER_MS / 2 in lib/presence/onlinePresence.ts — tolerates
// one missed beat before the server would consider this user offline.
const HEARTBEAT_INTERVAL_MS = 45_000;

type CountResponse = { data: { count: number } };

/**
 * Live count of distinct people currently using the app. Server-authoritative
 * (see lib/presence/onlinePresence.ts): a verifyAuth-gated heartbeat route
 * records this user as online in Redis with a TTL, and a broadcast ping (the
 * same "something changed, refetch" idiom every other realtime feature in
 * this app uses — see lib/realtime/broadcast.ts) tells other open tabs to
 * refetch the count via the count route.
 *
 * An earlier version of this hook used a raw client-side Supabase Realtime
 * Presence channel with no server involvement; security review rejected it
 * because this app has no Supabase-recognized identity (it authenticates via
 * Firebase) to gate a private/RLS-protected channel with, so an unauthenticated
 * third party holding only the public anon key could read or spoof it.
 *
 * Returns null until the first heartbeat response arrives, so callers can
 * avoid rendering a misleading "0 online" during the brief connect window.
 */
export function useOnlinePresence(): { count: number | null } {
  const { dbUser } = useAuth();
  const userId = dbUser?.id;
  const { apiFetch } = useApiClient();
  const [count, setCount] = useState<number | null>(null);

  const heartbeat = useCallback(async () => {
    const res = await apiFetch<CountResponse>("/api/presence/heartbeat", { method: "POST" });
    setCount(res.data.count);
  }, [apiFetch]);

  const refetchCount = useCallback(async () => {
    const res = await apiFetch<CountResponse>("/api/presence/count");
    setCount(res.data.count);
  }, [apiFetch]);

  useEffect(() => {
    if (!userId) return;
    heartbeat().catch((err) => console.error("[useOnlinePresence] heartbeat failed", err));
  }, [userId, heartbeat]);

  useVisibleInterval(
    () => {
      heartbeat().catch((err) => console.error("[useOnlinePresence] heartbeat failed", err));
    },
    HEARTBEAT_INTERVAL_MS,
    !!userId,
    { resumeHandledByRealtime: true },
  );

  useRealtimeChannel(userId ? realtimeTopics.onlinePresence : null, () => {
    refetchCount().catch((err) => console.error("[useOnlinePresence] refetch failed", err));
  });

  return { count };
}
