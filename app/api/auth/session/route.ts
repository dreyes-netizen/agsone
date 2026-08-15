import { NextResponse } from "next/server";

// Sign-out only. Minting the session cookie moved into POST /api/auth/bootstrap,
// which already had to verify the same ID token to load the profile — issuing
// the cookie from that one invocation instead of a second dedicated call is
// most of the point of that route. Clearing it stays here: sign-out has no
// token to verify and no profile to return, so it stays a standalone no-auth
// endpoint, and it runs once per session rather than hourly.
const COOKIE_NAME = "firebase-token";

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
