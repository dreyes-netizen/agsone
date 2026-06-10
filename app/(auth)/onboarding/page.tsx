"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";

type Department = { id: string; name: string };

export default function OnboardingPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, dbUser, refreshProfile } = useAuth();
  const { apiFetch } = useApiClient();

  const [displayName, setDisplayName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [birthday, setBirthday] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !authUser) return;
    setDisplayName(dbUser?.displayName ?? authUser.displayName ?? "");
    if (dbUser?.department?.id) setDepartmentId(dbUser.department.id);
    if (dbUser?.birthday) setBirthday(dbUser.birthday.slice(0, 10));
    apiFetch<{ data: Department[] }>("/api/departments").then((res) => setDepartments(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser, dbUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/auth/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          displayName,
          ...(departmentId ? { departmentId } : {}),
          ...(birthday ? { birthday } : {}),
        }),
      });
      await refreshProfile();
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8">

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-1" />
            </div>
            <span className="text-zinc-900 font-semibold">AGS One</span>
          </div>

          <div className="mb-7">
            <h1 className="text-xl font-bold text-zinc-900">Welcome aboard!</h1>
            <p className="text-zinc-500 text-sm mt-1">Let&apos;s set up your profile before you dive in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="displayName" className="block text-sm font-medium text-zinc-700">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={2}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition"
                placeholder="Your name"
              />
            </div>

            {!dbUser?.department && (
              <div className="space-y-1.5">
                <label htmlFor="department" className="block text-sm font-medium text-zinc-700">
                  Department{" "}
                  <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                {departments.length === 0 ? (
                  <p className="text-sm text-zinc-400 bg-zinc-50 rounded-lg px-3.5 py-2.5 border border-zinc-200">
                    No departments set up yet — an admin can assign you later.
                  </p>
                ) : (
                  <select
                    id="department"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition bg-white"
                  >
                    <option value="">Select your department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {!dbUser?.birthday && (
              <div className="space-y-1.5">
                <label htmlFor="birthday" className="block text-sm font-medium text-zinc-700">
                  Birthday{" "}
                  <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 transition"
                />
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#111827] hover:bg-gray-800 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : "Get Started"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
