"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Swords, Clock } from "lucide-react";

type DeptProgress = {
  deptId: string;
  deptName: string;
  progress: number;
};

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  metric: "TOTAL_POINTS" | "MISSIONS_COMPLETED" | "SHOUTOUTS_SENT";
  targetValue: number;
  startDate: string;
  endDate: string;
  deptProgress: DeptProgress[];
};

const metricLabel: Record<Challenge["metric"], string> = {
  TOTAL_POINTS: "Total Points",
  MISSIONS_COMPLETED: "Missions Completed",
  SHOUTOUTS_SENT: "Shoutouts Sent",
};

function timeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export default function ChallengesPage() {
  const { user, loading: authLoading, dbUser } = useAuth();
  const { apiFetch } = useApiClient();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Challenge[] }>("/api/challenges")
      .then((res) => setChallenges(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const myDeptId = dbUser?.department?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Department Challenges</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Collaborative goals your department is working toward together.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-5 animate-pulse">
              <div className="h-4 bg-zinc-100 rounded w-48 mb-3" />
              <div className="h-3 bg-zinc-100 rounded w-full mb-2" />
              <div className="h-3 bg-zinc-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-zinc-200 bg-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <Swords className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-zinc-900 font-semibold text-lg">No active challenges</p>
          <p className="text-zinc-400 text-sm mt-1">Check back when HR creates a new challenge.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map((challenge) => {
            const remaining = timeRemaining(challenge.endDate);
            const ended = remaining === "Ended";
            return (
              <div key={challenge.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-base font-bold text-zinc-900">{challenge.title}</h2>
                      {challenge.description && (
                        <p className="text-sm text-zinc-500 mt-0.5">{challenge.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full">
                        {metricLabel[challenge.metric]}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${ended ? "bg-zinc-100 text-zinc-500" : "bg-amber-50 text-amber-700"}`}>
                        <Clock className="w-3 h-3" />
                        {remaining}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Target: {challenge.targetValue.toLocaleString()}
                  </p>
                  {challenge.deptProgress.map((dp) => {
                    const pct = Math.min(100, Math.round((dp.progress / challenge.targetValue) * 100));
                    const isMyDept = dp.deptId === myDeptId;
                    const reached = dp.progress >= challenge.targetValue;
                    return (
                      <div key={dp.deptId} className={`rounded-xl p-3 border transition-colors ${isMyDept ? "border-navy-200 bg-navy-50/50 ring-1 ring-navy-200" : "border-zinc-100 bg-zinc-50/50"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-zinc-800">{dp.deptName}</span>
                            {isMyDept && <span className="text-xs font-medium text-navy-600 bg-navy-100 px-1.5 py-0.5 rounded-full">Your dept</span>}
                            {reached && <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">Goal reached!</span>}
                          </div>
                          <span className="text-xs text-zinc-500 font-medium">{dp.progress.toLocaleString()} / {challenge.targetValue.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${reached ? "bg-emerald-500" : isMyDept ? "bg-navy-500" : "bg-zinc-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
