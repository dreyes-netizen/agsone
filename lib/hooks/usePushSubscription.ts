"use client";

import { useCallback, useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";

/**
 * Registers the service worker and manages this device's push subscription.
 *
 * Deliberately never prompts on mount. Browsers penalise sites that ask for
 * notification permission unprompted, users reflexively deny, and a denial is
 * effectively permanent — the page cannot ask again, only the OS or browser
 * settings can undo it. Permission is requested exclusively from an explicit
 * user action in the preferences UI.
 */

export type PushStatus =
  | "loading"
  | "unsupported" // browser lacks the APIs, or push is not configured server-side
  | "ios-needs-install" // iOS only exposes Web Push to home-screen apps
  | "denied" // permission refused; unrecoverable from inside the page
  | "subscribed"
  | "unsubscribed";

/**
 * VAPID keys travel as base64url; `applicationServerKey` wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer rather than the `new Uint8Array(length)`
 * shorthand: the latter is typed `Uint8Array<ArrayBufferLike>`, which no longer
 * satisfies `BufferSource` (that requires a definite ArrayBuffer, not a
 * possible SharedArrayBuffer).
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !("MSStream" in window);

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates display-mode and uses a non-standard flag.
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export function usePushSubscription() {
  const { apiFetch } = useApiClient();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    if (typeof window === "undefined") return;

    const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!hasApis) {
      // On iOS this is the pre-16.4 case, or Safari outside a home-screen app.
      setStatus(isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported");
      return;
    }
    if (isIOS() && !isStandalone()) {
      setStatus("ios-needs-install");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const existing = await reg?.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, []);

  useEffect(() => {
    // Deferred: evaluate() resolves the unsupported / iOS / denied cases
    // synchronously before it awaits anything, and setting state directly in an
    // effect body triggers a cascading render. Same queueMicrotask pattern the
    // preferences tab uses for its initial load.
    queueMicrotask(() => void evaluate());
  }, [evaluate]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiFetch<{ data: { publicKey: string | null } }>("/api/push/subscribe");
      if (!data.publicKey) {
        setStatus("unsupported");
        setError("Push notifications aren't configured for this workspace yet.");
        return;
      }

      // Requested here, inside a click handler, so the browser treats it as
      // user-initiated.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          // Required by every browser: a push that shows nothing is not allowed.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        }));

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Incomplete subscription from the browser");
      }

      await apiFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setStatus("subscribed");
    } catch (err) {
      console.error("push subscribe failed", err);
      setError("Couldn't turn on push notifications. Please try again.");
      await evaluate();
    } finally {
      setBusy(false);
    }
  }, [apiFetch, evaluate]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Tell the server first: if the browser-side unsubscribe succeeds but
        // the request fails, the row is orphaned and we would keep sending to
        // an endpoint that now 410s.
        await apiFetch("/api/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {/* pruned on next send via 410 */});
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch (err) {
      console.error("push unsubscribe failed", err);
      setError("Couldn't turn off push notifications.");
    } finally {
      setBusy(false);
    }
  }, [apiFetch]);

  return { status, busy, error, subscribe, unsubscribe, refresh: evaluate };
}
