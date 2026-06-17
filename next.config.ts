import type { NextConfig } from "next";

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
  // Force HTTPS for 1 year (enable once you're on a real domain with HTTPS)
  // { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline for its runtime scripts; tighten with nonces if needed
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.googleapis.com",
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
      ].join(" "),
      // API connections — Firebase, Supabase realtime, Cloudinary, AI APIs
      [
        "connect-src 'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        "https://firebaseinstallations.googleapis.com",
        "https://api.cloudinary.com",
        "https://res.cloudinary.com",
        "https://generativelanguage.googleapis.com",
        "https://api.groq.com",
      ].join(" "),
      // Firebase auth popup
      `frame-src 'self' https://ags-one-82a7b.firebaseapp.com`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "xlsx"],
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

export default nextConfig;
