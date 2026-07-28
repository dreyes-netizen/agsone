/**
 * Tracks whether the current tab is visible, and — with a grace period —
 * whether Realtime should stay connected. Plain TS, no React: a tiny
 * pub/sub store that lazily attaches a single `visibilitychange` listener
 * the first time anyone subscribes.
 *
 * Two signals, on purpose:
 *  - `visible`        flips the instant the tab is hidden/shown. Gates polling
 *                      (restarting a `setInterval` is free, so no grace period).
 *  - `realtimeActive`  follows `visible`, but going false is delayed by
 *                      REALTIME_IDLE_GRACE_MS. Gates the Supabase websocket
 *                      (reopening a socket costs a reconnect + resync burst,
 *                      so a quick tab-flip shouldn't tear it down).
 *
 * Exported as a named constant so it's easy to shrink for manual testing.
 */
export const REALTIME_IDLE_GRACE_MS = 120_000;

type Listener = () => void;

let visible = true;
let realtimeActive = true;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let attached = false;

const visibleListeners = new Set<Listener>();
const realtimeActiveListeners = new Set<Listener>();

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function setVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  visibleListeners.forEach((l) => l());
}

function setRealtimeActive(next: boolean) {
  if (realtimeActive === next) return;
  realtimeActive = next;
  realtimeActiveListeners.forEach((l) => l());
}

function handleHidden() {
  setVisible(false);
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    setRealtimeActive(false);
  }, REALTIME_IDLE_GRACE_MS);
}

function handleVisible() {
  clearIdleTimer();
  setVisible(true);
  setRealtimeActive(true);
}

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    handleHidden();
  } else {
    handleVisible();
  }
}

function handlePageHide() {
  // bfcache navigation / mobile app-switch: drop immediately, no grace period.
  clearIdleTimer();
  setVisible(false);
  setRealtimeActive(false);
}

function handlePageShow() {
  clearIdleTimer();
  setVisible(true);
  setRealtimeActive(true);
}

function ensureAttached() {
  if (attached || typeof document === "undefined") return;
  attached = true;
  visible = document.visibilityState !== "hidden";
  realtimeActive = true;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
}

export function subscribeVisible(listener: Listener): () => void {
  ensureAttached();
  visibleListeners.add(listener);
  return () => visibleListeners.delete(listener);
}

export function subscribeRealtimeActive(listener: Listener): () => void {
  ensureAttached();
  realtimeActiveListeners.add(listener);
  return () => realtimeActiveListeners.delete(listener);
}

export function getVisibleSnapshot(): boolean {
  ensureAttached();
  return visible;
}

export function getRealtimeActiveSnapshot(): boolean {
  ensureAttached();
  return realtimeActive;
}
