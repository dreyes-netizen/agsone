"use client";

import { useSyncExternalStore } from "react";
import {
  subscribeVisible,
  subscribeRealtimeActive,
  getVisibleSnapshot,
  getRealtimeActiveSnapshot,
} from "@/lib/realtime/tabState";

// Server snapshot is always `true` so SSR/first paint assume "active" and
// nothing flickers on hydration.
function getServerSnapshot() {
  return true;
}

/** Whether the tab is currently visible. Use to gate polling. */
export function useTabVisible(): boolean {
  return useSyncExternalStore(subscribeVisible, getVisibleSnapshot, getServerSnapshot);
}

/**
 * Whether Realtime should stay connected — follows visibility with a grace
 * period (see REALTIME_IDLE_GRACE_MS in lib/realtime/tabState.ts). Use to
 * gate Supabase channel subscriptions.
 */
export function useRealtimeActive(): boolean {
  return useSyncExternalStore(subscribeRealtimeActive, getRealtimeActiveSnapshot, getServerSnapshot);
}
