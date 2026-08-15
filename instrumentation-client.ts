import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Mirrors the server sample rate in instrumentation.ts. Browser traces cost
  // no Vercel CPU, but keeping the two in step means a sampled page view and
  // its server span are far likelier to appear together.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.01 : 1.0,
});
