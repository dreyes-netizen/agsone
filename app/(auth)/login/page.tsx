"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { Trophy, Gamepad2, Gift, Target, Loader2 } from "lucide-react";

const FEATURES = [
  {
    icon: Trophy,
    color: "bg-amber-500/20",
    iconColor: "text-amber-400",
    label: "Leaderboard",
    desc: "Compete with colleagues and climb the weekly rankings.",
  },
  {
    icon: Target,
    color: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    label: "Missions & Streaks",
    desc: "Complete daily challenges to earn bonus points.",
  },
  {
    icon: Gamepad2,
    color: "bg-sky-500/20",
    iconColor: "text-sky-400",
    label: "Mini Games",
    desc: "Play quick games between tasks and win extra points.",
  },
  {
    icon: Gift,
    color: "bg-purple-500/20",
    iconColor: "text-purple-400",
    label: "Rewards Marketplace",
    desc: "Redeem your points for rewards, gadgets & experiences.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const syncRes = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (syncRes.status === 403) {
        await signOut(auth);
        setError("Your email is not registered in the system. Please contact HR to be added.");
        return;
      }

      // fetch() doesn't throw on HTTP errors, so a 500/502/network blip would
      // otherwise fall through to the dashboard with a Firebase session but no
      // synced DB user — breaking every /api/me-backed page. Fail closed.
      if (!syncRes.ok) {
        await signOut(auth);
        setError("Something went wrong while signing you in. Please try again.");
        return;
      }

      // Establish the HttpOnly session cookie BEFORE navigating, so the proxy
      // (which gates pages on this cookie) doesn't bounce the first /dashboard
      // request back to /login. AuthProvider also refreshes it on token change.
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex bg-white">

      {/* ── Left panel — desktop only ── */}
      <div className="hidden lg:flex w-[52%] bg-[#111827] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden="true"
        />

        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-[32rem] h-[32rem] rounded-full bg-white/5 blur-3xl -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white/5 blur-3xl translate-x-1/3 translate-y-1/3" aria-hidden="true" />

        {/* Center content */}
        <div className="relative z-10 space-y-10">
          {/* Tagline */}
          <div>
            <h2 className="text-[2.6rem] font-bold text-white leading-[1.15] tracking-tight">
              Work hard.<br />Play harder.<br />
              <span className="text-white/60">Get rewarded.</span>
            </h2>
            <p className="text-white/60 mt-4 text-sm leading-relaxed max-w-xs">
              Earn points for your contributions, redeem them for rewards, and compete with your colleagues.
            </p>
          </div>

          {/* Feature cards */}
          <div className="space-y-2.5">
            {FEATURES.map(({ icon: Icon, color, iconColor, label, desc }) => (
              <div
                key={label}
                className="flex items-center gap-3.5 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 hover:bg-white/[0.07] transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/35 text-[11px]">
          © {new Date().getFullYear()} Alliance Global Solutions
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-zinc-50">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #111827 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-sm">

          {/* Mobile branding */}
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            <Image src="/agslogo.png" alt="AGS One" width={72} height={72} className="object-contain mb-3" />
            <p className="text-zinc-900 font-bold text-xl leading-tight">AGS One</p>
            <p className="text-zinc-500 text-xs mb-2">Alliance Global Solutions</p>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              Earn points, redeem rewards, and compete with your colleagues.
            </p>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xl shadow-zinc-200/60 p-8">

            {/* Desktop logo inside card */}
            <div className="hidden lg:flex flex-col items-center mb-7">
              <Image src="/agslogo.png" alt="AGS One" width={80} height={80} className="object-contain mb-3" />
              <p className="text-zinc-900 font-bold text-base leading-tight">AGS One</p>
              <p className="text-zinc-500 text-xs">Alliance Global Solutions</p>
            </div>

            <div className="mb-7">
              <h1 className="text-xl font-bold text-zinc-900">Welcome back</h1>
              <p className="text-zinc-500 text-sm mt-1">Sign in with your company Google account.</p>
            </div>

            {/* Google sign-in button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              aria-busy={loading}
              className="cursor-pointer w-full flex items-center justify-center gap-3 bg-white border border-zinc-200 rounded-xl px-5 py-3 text-sm text-zinc-700 font-medium hover:bg-zinc-50 hover:border-zinc-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111827]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-zinc-500" aria-hidden="true" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            {error && (
              <div role="alert" className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-zinc-100 space-y-2 text-center">
              <p className="text-xs text-zinc-500">
                Use your{" "}
                <span className="text-zinc-700 font-medium">@allianceglobalsolutions.com</span>{" "}
                account
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                By signing in, you acknowledge this is a company system.
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs text-zinc-400 text-center">
            © {new Date().getFullYear()} Alliance Global Solutions
          </p>
        </div>
      </div>
    </main>
  );
}
