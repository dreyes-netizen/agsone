import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes AGS One installable to a home screen.
 *
 * This is not cosmetic: on iOS, Web Push only works for an app that has been
 * added to the home screen, so installability is a hard prerequisite for
 * notifications reaching a phone at all.
 *
 * Served from the metadata route (not a static file) so it stays in one place
 * with the rest of the app's metadata.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AGS One",
    short_name: "AGS One",
    description: "Earn points. Redeem rewards. Have fun at work.",
    // Straight to the feed. /dashboard is a routing-layer redirect now, so
    // launching there would cost every app open an extra hop.
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#111827", // Command Black, per .impeccable/design.json
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Launchers crop maskable icons to a circle/squircle, so this variant
      // keeps the logo inside the inner 80% safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
