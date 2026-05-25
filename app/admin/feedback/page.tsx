"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";

type FeedbackItem = {
  id: string;
  category: string;
  title: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { replies: number };
  author: { displayName: string; avatarUrl: string | null } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  COMPENSATION_BENEFITS: "Compensation & Benefits",
  WORK_LIFE_BALANCE: "Work-Life Balance",
  COMPANY_CULTURE: "Company Culture",
  TEAM_DYNAMICS: "Team Dynamics",
  PROCESSES_TOOLS: "Processes & Tools",
  RECOGNITION: "Recognition",
  OTHER: "Other",
};

const STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-gray-100 text-gray-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

const STATUS_TABS = ["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const;
const STATUS_TAB_LABELS: Record<string, string> = { ALL: "All", OPEN: "Open", IN_REVIEW: "In Review", RESOLVED: "Resolved" };

export default function AdminFeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  useEffect(() => {
    if (authLoading || !user) return;
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    const query = params.toString() ? `?${params}` : "";
    setLoading(true);
    apiFetch<{ data: FeedbackItem[] }>(`/api/admin/feedback${query}`)
      .then((r) => setFeedbacks(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, statusFilter, categoryFilter]);

  const thClass = "text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const tdClass = "px-5 py-3";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback Inbox</h1>
        <p className="text-gray-500 text-sm mt-1">Review and respond to employee feedback.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${statusFilter === tab ? "bg-[#111827] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {STATUS_TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>Status</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Title</th>
              <th className={thClass}>Submitted By</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Replies</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : feedbacks.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No feedback found.</td></tr>
            ) : feedbacks.map((f) => (
              <tr
                key={f.id}
                onClick={() => router.push(`/admin/feedback/${f.id}`)}
                className="hover:bg-gray-50/60 cursor-pointer transition-colors border-b border-gray-50"
              >
                <td className={tdClass}>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CHIP[f.status]}`}>
                    {f.status === "IN_REVIEW" ? "In Review" : f.status === "OPEN" ? "Open" : "Resolved"}
                  </span>
                </td>
                <td className={tdClass + " text-gray-600"}>{CATEGORY_LABELS[f.category]}</td>
                <td className={tdClass}>
                  <p className="font-medium text-gray-900 truncate max-w-xs">{f.title}</p>
                </td>
                <td className={tdClass + " text-gray-600"}>
                  {f.isAnonymous ? "Anonymous" : (f.author?.displayName ?? "—")}
                </td>
                <td className={tdClass + " text-gray-400 text-xs"}>{new Date(f.createdAt).toLocaleDateString()}</td>
                <td className={tdClass + " text-gray-500"}>{f._count.replies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
