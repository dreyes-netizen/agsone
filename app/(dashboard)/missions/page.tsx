"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Target, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type MyCompletion = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  completedAt: string;
};

type Mission = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  type: "INDIVIDUAL" | "TEAM";
  startDate: string | null;
  endDate: string | null;
  myCompletion: MyCompletion | null;
};

type Filter = "AVAILABLE" | "COMPLETED" | "ALL";

export default function MissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("AVAILABLE");
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Mission[] }>("/api/missions")
      .then((r) => setMissions(r.data))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleMarkComplete(mission: Mission) {
    if (!confirm(`Mark "${mission.title}" as complete? HR will review your submission.`)) return;
    setSubmitting(mission.id);
    try {
      await apiFetch(`/api/missions/${mission.id}/complete`, { method: "POST" });
      setMissions((prev) =>
        prev.map((m) =>
          m.id === mission.id
            ? { ...m, myCompletion: { id: "", status: "PENDING", adminNote: null, completedAt: new Date().toISOString() } }
            : m
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(null);
    }
  }

  const filtered = missions.filter((m) => {
    if (filter === "AVAILABLE") return !m.myCompletion || m.myCompletion.status === "REJECTED";
    if (filter === "COMPLETED") return m.myCompletion?.status === "PENDING" || m.myCompletion?.status === "APPROVED";
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Missions</h1>
        <p className="text-zinc-500 text-sm mt-1">Complete challenges to earn points</p>
      </div>

      <div className="flex gap-2">
        {(["AVAILABLE", "COMPLETED", "ALL"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              filter === f
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {f === "AVAILABLE" ? "Available" : f === "COMPLETED" ? "Completed" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5 animate-pulse space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100" />
              <div className="h-4 bg-zinc-100 rounded w-3/4" />
              <div className="h-3 bg-zinc-100 rounded w-full" />
              <div className="h-9 bg-zinc-100 rounded-lg w-full mt-4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-200 text-center">
          <Target className="w-10 h-10 text-zinc-200 mb-4" />
          <p className="text-zinc-600 font-medium">No missions here</p>
          <p className="text-zinc-400 text-sm mt-1">
            {filter === "AVAILABLE" ? "Check back soon — HR will add new missions!" : "Nothing to show for this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mission) => {
            const comp = mission.myCompletion;
            const busy = submitting === mission.id;

            return (
              <div key={mission.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
                <div className={`h-1 ${comp?.status === "APPROVED" ? "bg-emerald-500" : comp?.status === "REJECTED" ? "bg-red-400" : comp?.status === "PENDING" ? "bg-amber-400" : "bg-indigo-500"}`} />

                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Target className="w-5 h-5 text-indigo-500" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                      {mission.type === "INDIVIDUAL" ? "Individual" : "Team"}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-zinc-900 leading-snug">{mission.title}</h3>
                    {mission.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{mission.description}</p>
                    )}
                  </div>

                  {mission.endDate && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="w-3.5 h-3.5" />
                      Ends {new Date(mission.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  )}

                  {comp?.status === "REJECTED" && comp.adminNote && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      Not approved: {comp.adminNote}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100 mt-auto">
                    <p className="font-bold text-lg text-indigo-600 tabular-nums leading-none">
                      {mission.pointsReward.toLocaleString()}
                      <span className="text-sm font-medium ml-1 text-zinc-400">pts</span>
                    </p>

                    {!comp && (
                      <button
                        onClick={() => handleMarkComplete(mission)}
                        disabled={busy}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {busy ? "Submitting…" : "Mark Complete"}
                      </button>
                    )}
                    {comp?.status === "PENDING" && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Pending Review
                      </span>
                    )}
                    {comp?.status === "APPROVED" && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    )}
                    {comp?.status === "REJECTED" && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        <XCircle className="w-3.5 h-3.5" /> Not Approved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
