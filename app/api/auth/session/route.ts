import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

// HttpOnly server-minted session cookie. Replaces the old JS-readable
// `firebase-token` cookie (which any XSS could exfiltrate). The proxy reads
// this for page-level gating; API routes still authorize via the Bearer token.
const COOKIE_NAME = "firebase-token";
const EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5; // 5 days (Firebase allows 5min–2wk)

// POST: exchange a fresh Firebase ID token (Bearer) for an HttpOnly session cookie.
export async function POST(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.split("Bearer ")[1];
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: EXPIRES_IN_MS / 1000,
    });
    return res;
  } catch (err) {
    console.error("[POST /api/auth/session]", err);
    return NextResponse.json({ error: "Could not create session" }, { status: 401 });
  }
}

// DELETE: clear the session cookie on sign-out.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
