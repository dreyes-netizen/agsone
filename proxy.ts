import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  // Everything reaching here is an authenticated-only page by construction —
  // see the allowlist matcher below — so there is no public-path escape hatch
  // to check first.
  const token = req.cookies.get("firebase-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // An explicit allowlist of authenticated page routes, rather than the
  // "everything except..." negative lookahead this used to be.
  //
  // Why: the old pattern still *invoked* this function on /login, /onboarding,
  // robots.txt and every other public path, only to fall straight through the
  // early return. On Vercel the invocation is the cost, not the work inside it
  // — Proxy was 13.1% of total Active CPU for what amounts to one cookie read.
  // An allowlist skips those paths in the routing layer instead.
  //
  // /api/* is deliberately absent so API routes return their own JSON 401 via
  // verifyAuth rather than a 307 to the /login HTML page. This remains a
  // page-level UX redirect only; per-route verifyAuth is the real
  // authorization boundary. There are no Server Functions in this codebase, so
  // narrowing the matcher cannot silently drop coverage for one (see the Proxy
  // execution-order docs).
  //
  // "/" and "/dashboard" are absent because next.config.ts redirects() now
  // handles both in the routing layer at step 2, ahead of Proxy at step 3.
  //
  // Written as an alternation rather than bare prefixes because matchers are
  // anchored to the start of the path: a plain "/feed" entry would also match
  // "/feedback". Harmless today since both require auth, but not something to
  // leave resting on a coincidence. The trailing (/.*)? covers sub-paths such
  // as /minigames/<id> and /employees/<id>, and keeps /sw.js and
  // /manifest.webmanifest out of Proxy for the upcoming PWA work.
  matcher: [
    "/(admin|employees|feed|feedback|food|leaderboard|marketplace|medicine|minigames|onboarding|profile)(/.*)?",
  ],
};
