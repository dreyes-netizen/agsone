"use client";

import { useEffect, useRef } from "react";
import { useTabVisible } from "@/lib/hooks/useTabState";

/**
 * Like `setInterval(fn, ms)`, but paused while the tab is hidden — a
 * background tab has no reason to keep polling an API nobody is looking at.
 *
 * On the hidden → visible transition it fires `fn()` immediately (catch-up
 * refetch) before resuming the interval, so returning to the tab doesn't
 * mean staring at stale data for up to `ms` longer.
 *
 * Pass `enabled = false` to stop polling entirely regardless of visibility
 * (e.g. once a game has finished) — mirrors the existing stop conditions at
 * the call sites this replaces.
 *
 * Pass `resumeHandledByRealtime` when the same callback is also wired to a
 * `useRealtimeChannel` on this screen. Without it the tab-return refetch runs
 * twice: once here, and once from the resync `lifecycle.goOnline()` fires at
 * lib/realtime/lifecycle.ts:92. Skipping the catch-up loses nothing in either
 * direction — a short absence keeps the socket connected so broadcasts arrived
 * live, and a long one drops it, which is precisely when the resync fires.
 */
export function useVisibleInterval(
  fn: () => void,
  ms: number,
  enabled = true,
  { resumeHandledByRealtime = false }: { resumeHandledByRealtime?: boolean } = {},
) {
  const cb = useRef(fn);
  useEffect(() => {
    cb.current = fn;
  });
  const visible = useTabVisible();
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (!enabled || !visible) return;

    // Catch-up fetch on resume, but not on first mount (the caller already
    // fetches on mount) and not when a realtime resync already covers it.
    if (!wasVisible.current && !resumeHandledByRealtime) {
      cb.current();
    }

    const interval = setInterval(() => cb.current(), ms);
    return () => clearInterval(interval);
  }, [enabled, visible, ms, resumeHandledByRealtime]);

  useEffect(() => {
    wasVisible.current = visible;
  }, [visible]);
}
