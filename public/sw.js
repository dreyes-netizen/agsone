/*
 * AGS One service worker — push notifications only.
 *
 * Deliberately does NOT cache anything. An offline shell on a live points app
 * is worse than a spinner: stale balances, stale approval queues, stale game
 * state. Next 16 ships an experimental `useOffline` hook if connectivity-aware
 * UI is ever wanted; that is a separate decision from push.
 *
 * Served from the origin root so its scope covers the whole app, and with
 * no-store headers (see next.config.ts) so a new worker is picked up promptly.
 */

// Take over as soon as possible rather than waiting for every tab to close —
// otherwise a fix to this file could sit unused for days.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Never surface a raw/undecodable payload to the user.
    payload = { title: "AGS One", body: "You have a new notification." };
  }

  const title = payload.title || "AGS One";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/badge-72.png",
    // Collapses repeats of the same thing (e.g. reactions on one post) into a
    // single OS notification instead of stacking, mirroring the server-side
    // grouping in createNotification.
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/feed" },
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/feed";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Prefer an AGS One window that is already open: focus it and navigate
      // in place. Opening a second window every time a notification is tapped
      // is a common and very annoying PWA bug.
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // Cross-document navigate can reject; focusing is still useful.
            }
          }
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
