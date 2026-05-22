"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";

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
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />
        {/* Soft glow */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl translate-x-1/2 translate-y-1/2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-1" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">AGS One</span>
        </div>

        {/* Copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Work hard.<br />Play harder.<br />
              <span className="text-indigo-400">Get rewarded.</span>
            </h2>
            <p className="text-white/40 mt-4 text-sm leading-relaxed max-w-sm">
              Earn points for your contributions, redeem them for rewards, and compete with your colleagues.
            </p>
          </div>

          <div className="flex gap-6">
            {[["🏆", "Leaderboards"], ["🎁", "Rewards"], ["🎡", "Mini Games"]].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <span className="text-white/40 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/15 text-xs">Alliance Global Solutions</div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-1" />
            </div>
            <span className="text-zinc-900 font-semibold text-lg">AGS One</span>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8">
            <div className="mb-7">
              <h1 className="text-xl font-bold text-zinc-900">Sign in</h1>
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
              Use your <span className="text-zinc-600 font-medium">@allianceglobalsolutions.com</span> account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
