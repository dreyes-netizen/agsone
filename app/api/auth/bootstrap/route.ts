import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma/client";
import { scheduleBroadcast } from "@/lib/realtime/broadcast";
import { realtimeTopics } from "@/lib/realtime/topics";
import { PROFILE_SELECT, stripInternal } from "@/lib/auth/profileSelect";

/**
 * One round trip for "who is this user, and give them a session".
 *
 * Replaces three separate authenticated requests that AuthProvider (and the
 * login page) used to fire for a single sign-in:
 *
 *   POST /api/auth/session  → createSessionCookie (verifies the token itself)
 *   POST /api/auth/sync     → verifyIdToken + 1-3 Prisma queries
 *   GET  /api/me            → verifyToken + 1 Prisma query
 *
 * That was three RSA-SHA256 verifies and up to four DB queries to answer one
 * question. It mattered more than it looks: `onIdTokenChanged` also fires on
 * Firebase's ~hourly silent token refresh, so the trio repeated every hour for
 * every open tab, not just on navigation. On Vercel the invocation itself is
 * the unit of cost, so collapsing 3 → 1 is the largest single reduction
 * available in this app.
 *
 * The happy path here is one verify and one query.
 */

const COOKIE_NAME = "firebase-token";
const EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5; // 5 days (Firebase allows 5min–2wk)

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.split("Bearer ")[1];
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hot path: an already-linked user resolves in this one query.
    let profile = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: PROFILE_SELECT,
    });

    // First sign-in: link the Firebase UID onto the account HR pre-created via
    // the admin employee sync. Anyone without a matching pending row is not in
    // the directory and gets no access.
    if (!profile) {
      const email = decoded.email ?? "";
      const fallbackName = decoded.name ?? decoded.email ?? "New Employee";

      const pending = email
        ? await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, firebaseUid: null },
            select: { id: true, displayName: true, avatarUrl: true },
          })
        : null;

      if (!pending) {
        return NextResponse.json({ error: "not_in_directory" }, { status: 403 });
      }

      profile = await prisma.user.update({
        where: { id: pending.id },
        data: {
          firebaseUid: decoded.uid,
          avatarUrl: pending.avatarUrl ?? decoded.picture ?? null,
          // Keep the imported displayName unless it's just the email placeholder.
          displayName: pending.displayName !== email ? pending.displayName : fallbackName,
        },
        select: PROFILE_SELECT,
      });

      scheduleBroadcast([
        { topic: realtimeTopics.profile(pending.id) },
        { topic: realtimeTopics.employees },
        { topic: realtimeTopics.adminAnalytics },
      ]);
    }

    // A deactivated employee's Firebase token stays technically valid, so this
    // gate is what actually stops them. Returning 403 (rather than the 401 the
    // old /api/me returned) lets the client sign them out instead of leaving
    // them in the app with a null profile and every page silently broken.
    // Note this is a convenience, not the security boundary — verifyAuth
    // re-checks isActive on every API route regardless.
    if (!profile.isActive) {
      return NextResponse.json({ error: "account_deactivated" }, { status: 403 });
    }

    // HttpOnly, server-minted. The proxy gates pages on its presence; API
    // routes still authorize off the Bearer token, never this.
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    });

    const res = NextResponse.json({ data: stripInternal(profile) });
    res.cookies.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: EXPIRES_IN_MS / 1000,
    });
    return res;
  } catch (err) {
    console.error("[POST /api/auth/bootstrap]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
