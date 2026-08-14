import path from "path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Strict referrer — don't leak URL to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Force HTTPS for 1 year. Browsers only honor this over an actual HTTPS
  // connection, so it's a no-op on local http://localhost dev.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline; Firebase auth loads scripts from apis.google.com
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://apis.googleapis.com https://www.gstatic.com",
      // Tailwind + styled-jsx require unsafe-inline for styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Images from known CDNs only
      [
        "img-src 'self' blob: data:",
        "https://res.cloudinary.com",
        "https://lh3.googleusercontent.com",
        "https://firebasestorage.googleapis.com",
        "https://*.supabase.co",
        "https://api.dicebear.com",
        // GIF comments — GIPHY's API terms require media to be loaded
        // directly from their CDN, never proxied/re-hosted by us
        "https://*.giphy.com",
      ].join(" "),
      // API connections — Firebase, Supabase realtime, Cloudinary, AI APIs
      [
        "connect-src 'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        // Wildcard covers all Google/Firebase services (auth, storage, functions, etc.)
        "https://*.googleapis.com",
        "https://*.google.com",
        "https://accounts.google.com",
        "https://*.firebaseapp.com",
        "https://*.firebase.com",
        "https://api.cloudinary.com",
        "https://res.cloudinary.com",
        "https://api.groq.com",
        // GIF search/trending — GIPHY requires these calls made directly
        // from the client, not proxied through our own API routes
        "https://api.giphy.com",
      ].join(" "),
      // Firebase auth popup and Google OAuth page
      [
        "frame-src 'self'",
        `https://ags-one-82a7b.firebaseapp.com`,
        "https://accounts.google.com",
        "https://*.google.com",
      ].join(" "),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // upgrade-insecure-requests intentionally omitted — breaks localhost (HTTP)
      // Re-enable only when deployed on a fully HTTPS domain
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["firebase-admin", "exceljs"],
  devIndicators: false,
  allowedDevOrigins: ["jinx-delicious-jawline.ngrok-free.dev", "*.ngrok-free.dev"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Wraps the build with Sentry's webpack/Turbopack plugin (source maps, release
// tagging). Inert with no visible effect until SENTRY_AUTH_TOKEN/SENTRY_ORG/
// SENTRY_PROJECT are set -- safe to ship ahead of having a Sentry project.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
