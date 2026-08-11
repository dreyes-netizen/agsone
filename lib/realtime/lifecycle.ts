"use client";

import { getBrowserSupabase } from "@/lib/supabase/browserClient";
import { subscribeRealtimeActive, getRealtimeActiveSnapshot } from "@/lib/realtime/tabState";

/**
 * Owns the actual Supabase Realtime socket connect/disconnect, driven by
 * tabState's `realtimeActive` signal (visible, or hidden for less than the
 * grace period — see REALTIME_IDLE_GRACE_MS in lib/realtime/tabState.ts).
 *
 * We deliberately do NOT tear individual channels down (no `removeChannel`)
 * to go idle. Per the installed @supabase/realtime-js + @supabase/phoenix
 * source: once a channel is unsubscribed, its `joinedOnce` flag is set and
 * it can never rejoin — `channel.subscribe()` throws synchronously after
 * that. Disconnecting the shared socket instead leaves every channel in an
 * "errored" state that Phoenix rejoins automatically the moment the socket
 * reconnects (a channel's `socket.onOpen` handler calls `rejoin()` for any
 * errored channel) — no React involvement, no channel re-creation, no
 * one-way-door risk.
 *
 * Every transition is serialized through `chain` and stamped with a
 * `generation` counter. This matters because `disconnect()` and `connect()`
 * are both async under the hood (Phoenix's teardown/connect handshake), and
 * calling `connect()` while the socket is still mid-disconnect is a silent
 * no-op — worse, `disconnect()` marks the close as "clean", which tells
 * Phoenix's own reconnect logic to stay out of the way. Without the
 * generation guard, a quick hide→show right at the grace-period boundary
 * could leave the socket permanently offline with no error and no retry.
 * The watchdog below is the backstop for that case.
 */

type Listener = () => void;

const resyncListeners = new Set<Listener>();
let attached = false;
let generation = 0;
let chain: Promise<void> = Promise.resolve();
let keepAliveCount = 0;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(task: () => Promise<void> | void) {
  chain = chain.then(task).catch((err) => console.error("realtime lifecycle task failed", err));
}

function clearWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

// ~5s after a connect attempt, retry once if the socket never came up. This
// is the only reliable escape from the "closing"-state no-op described above.
function scheduleWatchdog(gen: number) {
  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    watchdogTimer = null;
    if (gen !== generation) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const supabase = getBrowserSupabase();
    if (!supabase.realtime.isConnected() && !supabase.realtime.isConnecting()) {
      supabase.realtime.connect();
    }
  }, 5_000);
}

function goOffline() {
  if (keepAliveCount > 0) return;
  const gen = ++generation;
  enqueue(async () => {
    if (gen !== generation) return; // superseded by a later transition
    if (typeof document !== "undefined" && document.visibilityState !== "hidden") return;
    const supabase = getBrowserSupabase();
    await supabase.realtime.disconnect(1000, "idle: tab hidden");
  });
}

function goOnline() {
  const gen = ++generation;
  enqueue(() => {
    if (gen !== generation) return;
    const supabase = getBrowserSupabase();
    if (!supabase.realtime.isConnected() && !supabase.realtime.isConnecting()) {
      supabase.realtime.connect();
    }
  });
  scheduleWatchdog(gen);

  // Resync regardless of socket state: broadcasts sent while disconnected are
  // gone for good (no replay on public channels), so every consumer must
  // refetch on wake rather than just wait for its channel to rejoin.
  resyncListeners.forEach((l) => l());
}

function ensureAttached() {
  if (attached) return;
  attached = true;
  subscribeRealtimeActive(() => {
    if (getRealtimeActiveSnapshot()) goOnline();
    else goOffline();
  });
}

/** Register a callback to run once when the tab wakes from a suspended socket. */
export function subscribeResync(listener: Listener): () => void {
  ensureAttached();
  resyncListeners.add(listener);
  return () => resyncListeners.delete(listener);
}

/**
 * Escape hatch: while any caller holds a keep-alive pin, a *new* idle
 * disconnect is skipped (a disconnect already in flight when the pin is
 * taken is not cancelled retroactively). Returns an unpin function — call it
 * on unmount.
 */
export function pinRealtimeAlive(): () => void {
  ensureAttached();
  keepAliveCount++;
  return () => {
    keepAliveCount = Math.max(0, keepAliveCount - 1);
  };
}
