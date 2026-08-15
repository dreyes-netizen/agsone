import * as Sentry from "@sentry/nextjs";

// Building and shipping a trace transaction costs real Active CPU on every
// sampled request, and Vercel Hobby meters that. 1% is enough to spot a
// latency regression across ~150 users; error reporting is a separate pipeline
// and is unaffected by this (see `onRequestError` below).
const TRACES_SAMPLE_RATE = process.env.NODE_ENV === "production" ? 0.01 : 1.0;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: TRACES_SAMPLE_RATE,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: TRACES_SAMPLE_RATE,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
