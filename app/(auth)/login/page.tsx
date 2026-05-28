"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { Trophy, Gamepad2, Gift, Target } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-zinc-50">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-1/2 bg-[#111827] flex-col justify-between p-12 relative overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glows */}
        <div className="absolute top-0 left-0 w-[28rem] h-[28rem] rounded-full bg-indigo-600/20 blur-3xl -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-violet-600/20 blur-3xl translate-x-1/4 translate-y-1/4" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />

        {/* Large logo — decorative, pinned to the right */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-[1] w-64 h-64 rounded-3xl bg-white shadow-2xl flex items-center justify-center overflow-hidden">
          <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-4" />
        </div>

        {/* Branding at top */}
        <div className="relative z-10">
          <p className="text-white font-bold text-base leading-tight">AGS One</p>
          <p className="text-white/40 text-xs">Alliance Global Solutions</p>
        </div>

        {/* Tagline + feature cards */}
        <div className="relative z-10 space-y-8 max-w-[52%]">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Work hard.<br />Play harder.<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Get rewarded.
              </span>
            </h2>
            <p className="text-white/40 mt-4 text-sm leading-relaxed max-w-sm">
              Earn points for your contributions, redeem them for rewards, and compete with your colleagues.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-3">
            {[
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
                color: "bg-blue-500/20",
                iconColor: "text-blue-400",
                label: "Mini Games",
                desc: "Play quick games between tasks and win extra points.",
              },
              {
                icon: Gift,
                color: "bg-violet-500/20",
                iconColor: "text-violet-400",
                label: "Rewards Marketplace",
                desc: "Redeem your points for cash, gadgets & experiences.",
              },
            ].map(({ icon: Icon, color, iconColor, label, desc }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/15 text-xs">
          © {new Date().getFullYear()} Alliance Global Solutions
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            <img src="/agslogo.png" alt="AGS One" className="w-28 h-28 object-contain mb-4" />
            <p className="text-zinc-900 font-bold text-xl leading-tight">AGS One</p>
            <p className="text-zinc-400 text-xs mb-3">Alliance Global Solutions</p>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              Earn points, redeem rewards, and compete with your colleagues.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8">
            <div className="mb-7">
              <h1 className="text-xl font-bold text-zinc-900">Welcome back</h1>
              <p className="text-zinc-400 text-sm mt-1">Use your company Google account to continue.</p>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-200 rounded-lg px-5 py-2.5 text-sm text-zinc-700 font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            {error && (
              <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <p className="mt-6 text-xs text-zinc-400 text-center">
              Use your{" "}
              <span className="text-zinc-600 font-medium">@allianceglobalsolutions.com</span>{" "}
              account
            </p>

            <p className="mt-4 text-[11px] text-zinc-400 text-center leading-relaxed">
              By signing in, you acknowledge this is a company system.
            </p>
          </div>

          <p className="mt-6 text-xs text-zinc-400 text-center">
            © {new Date().getFullYear()} Alliance Global Solutions
          </p>
        </div>
      </div>
    </div>
  );
}
