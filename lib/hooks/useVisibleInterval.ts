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
 */
export function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  const cb = useRef(fn);
  useEffect(() => { cb.current = fn; });
  const visible = useTabVisible();
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (!enabled || !visible) return;

    // Catch-up fetch on resume, but not on first mount (the caller already
    // fetches on mount).
    if (!wasVisible.current) {
      cb.current();
    }

    const interval = setInterval(() => cb.current(), ms);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, visible, ms]);

  useEffect(() => {
    wasVisible.current = visible;
  }, [visible]);
}
