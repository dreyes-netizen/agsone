"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { WhistleIcon } from "@/components/icons/WhistleIcon";
import { Pagination } from "@/components/ui/pagination";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants/feedbackCategories";

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
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    if (authLoading || !user) return;
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    setLoading(true);
    apiFetch<{ data: FeedbackItem[]; pages: number }>(`/api/admin/feedback?${params}`)
      .then((r) => { setFeedbacks(r.data); setPages(r.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, statusFilter, categoryFilter, page]);

  useEffect(() => { setPage(1); }, [statusFilter, categoryFilter]);

  const thClass = "text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5";
  const tdClass = "px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
          <WhistleIcon className="w-5 h-5 text-red-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Whistleblower Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Confidential reports visible only to HR and authorized investigators.</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-red-600 text-sm font-bold"><span aria-hidden="true">🔒</span> Confidential Channel</span>
        <span className="text-red-500 text-xs">
          Reports visible only to HR and authorized investigators. Retaliation is strictly prohibited.
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900 ${statusFilter === tab ? "bg-command-black text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {STATUS_TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-900"
        >
          <option value="">All Categories</option>
          <option value="HARASSMENT_DISCRIMINATION">Harassment &amp; Discrimination</option>
          <option value="ETHICAL_FRAUD">Ethical Violations &amp; Fraud</option>
          <option value="MISCONDUCT_ABUSE">Workplace Misconduct &amp; Abuse of Authority</option>
          <option value="SECURITY_POLICY">Security Concerns &amp; Policy Violations</option>
        </select>
      </div>

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        <div className="overflow-auto max-h-[70vh] scroll-hint">
        <table className="w-full border-collapse" aria-label="Whistleblower reports">
          <thead className="sticky top-0 z-10 bg-table-head">
            <tr className="border-b border-table-border">
              <th scope="col" className={thClass}>Status</th>
              <th scope="col" className={thClass}>Category</th>
              <th scope="col" className={thClass}>Title</th>
              <th scope="col" className={thClass}>Submitted By</th>
              <th scope="col" className={thClass}>Date</th>
              <th scope="col" className={thClass}>Replies</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…</div></td></tr>
            ) : feedbacks.length === 0 ? (
              <tr><td colSpan={6}><div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-500 text-sm"><ShieldAlert className="w-8 h-8 text-gray-300" aria-hidden="true" /><span>No feedback found.</span></div></td></tr>
            ) : feedbacks.map((f, i) => (
              <tr
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/admin/feedback/${f.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/admin/feedback/${f.id}`)}
                className={`border-b border-row-border transition-colors hover:bg-row-hover cursor-pointer focus-visible:outline-none focus-visible:bg-gray-100 ${i % 2 === 1 ? "bg-row-alt" : ""}`}
              >
                <td className={tdClass}>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CHIP[f.status]}`}>
                    {f.status === "IN_REVIEW" ? "In Review" : f.status === "OPEN" ? "Open" : "Resolved"}
                  </span>
                </td>
                <td className={tdClass}>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[f.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {CATEGORY_LABELS[f.category] ?? f.category}
                  </span>
                </td>
                <td className={tdClass}>
                  <p className="font-medium text-gray-900 truncate max-w-xs">{f.title}</p>
                </td>
                <td className={tdClass + " text-gray-600"}>
                  {f.isAnonymous ? "Anonymous" : (f.author?.displayName ?? "—")}
                </td>
                <td className={tdClass + " text-gray-500 text-xs"}>{new Date(f.createdAt).toLocaleDateString()}</td>
                <td className={tdClass + " text-gray-500"}>{f._count.replies}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}
