"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { useVisibleInterval } from "@/lib/hooks/useVisibleInterval";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";
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
  // Read-only here: this component never prompts for permission, it only wants
  // to know whether push is already covering this device.
  const { status: pushStatus } = usePushSubscription();

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Slow fallback poll — Realtime delivers new notifications instantly; this
  // only backstops a rare dropped message. It is paused while hidden, and the
  // Realtime lifecycle resyncs on wake.
  //
  // Stretched to 20 minutes once this device has a push subscription. Push is
  // the channel that actually reaches a closed app, so the poll's job shrinks
  // to catching a broadcast dropped on a healthy socket — which does not need
  // checking every five minutes. Everyone else (unsupported browser, denied
  // permission, iOS not yet installed) keeps the tighter interval, because for
  // them this poll is still the only backstop there is.
  //
  // This is the single largest remaining Active CPU reduction in the app: each
  // poll costs an RSA verify plus two Prisma round trips, across every open tab.
  const pushActive = pushStatus === "subscribed";
  useVisibleInterval(load, pushActive ? 1_200_000 : 300_000, !authLoading && !!user, {
    resumeHandledByRealtime: true,
  });

  // Real-time: refresh the bell the moment a notification (invite, win, etc.)
  // is created for this user.
  useRealtimeChannel(dbUser ? `user:${dbUser.id}` : null, load);

  return null;
}
