"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { useNotificationsStore } from "@/lib/stores/notifications";

/**
 * Owns the notification fetch-on-mount, fallback poll, and Realtime
 * subscription — mount this ONCE per dashboard layout (see
 * app/(dashboard)/layout.tsx). Every <NotificationBell> just reads the
 * shared store; only this controller talks to the network.
 */
export function NotificationsController() {
  const { user, loading: authLoading, dbUser } = useAuth();
  const load = useNotificationsStore((s) => s.load);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Slow fallback poll — Realtime delivers new notifications instantly; this
  // only backstops a rare dropped message. Five minutes avoids spending a
  // function invocation every minute while the websocket is healthy. It is
  // still paused while hidden, and the Realtime lifecycle resyncs on wake.
  useVisibleInterval(load, 300_000, !authLoading && !!user);

  // Real-time: refresh the bell the moment a notification (invite, win, etc.)
  // is created for this user.
  useRealtimeChannel(dbUser ? `user:${dbUser.id}` : null, load);

  return null;
}
