"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type FeedbackItem = {
  id: string;
  category: string;
  title: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { replies: number };
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

const CATEGORY_COLORS: Record<string, string> = {
  COMPENSATION_BENEFITS: "bg-emerald-100 text-emerald-700",
  WORK_LIFE_BALANCE: "bg-sky-100 text-sky-700",
  COMPANY_CULTURE: "bg-violet-100 text-violet-700",
  TEAM_DYNAMICS: "bg-orange-100 text-orange-700",
  PROCESSES_TOOLS: "bg-gray-100 text-gray-700",
  RECOGNITION: "bg-amber-100 text-amber-700",
  OTHER: "bg-zinc-100 text-zinc-600",
};

const STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-gray-100 text-gray-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
};

export default function FeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: FeedbackItem[] }>("/api/feedback")
      .then((r) => setFeedbacks(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (!showModal) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setShowModal(false); resetForm(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  function resetForm() {
    setTitle("");
    setCategory("");
    setBody("");
    setIsAnonymous(false);
  }

  async function handleSubmit() {
    if (!title || !category || !body) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: FeedbackItem }>("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ title, category, body, isAnonymous }),
      });
      setFeedbacks((prev) => [{ ...res.data, _count: { replies: 0 } }, ...prev]);
      setShowModal(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Feedback</h1>
          <p className="text-gray-500 text-sm mt-1">Submit feedback to HR privately.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Feedback
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">You haven&apos;t submitted any feedback yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-sm font-medium text-[#111827] underline"
          >
            Submit your first feedback
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((f) => (
            <button
              key={f.id}
              onClick={() => router.push(`/feedback`)}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-gray-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[f.category]}`}>
                      {CATEGORY_LABELS[f.category]}
                    </span>
                    {f.isAnonymous && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Anonymous
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{f.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {f._count.replies} {f._count.replies === 1 ? "reply" : "replies"} · Last updated{" "}
                    {new Date(f.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CHIP[f.status]}`}>
                  {STATUS_LABEL[f.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Submit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Feedback</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  type="text"
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white"
                >
                  <option value="">Select a category</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Details
                  <span className="text-gray-400 font-normal ml-1">({body.length}/1000)</span>
                </label>
                <textarea
                  rows={5}
                  maxLength={1000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe your feedback in detail..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
                />
              </div>

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  onClick={() => setIsAnonymous((v) => !v)}
                  className={`relative shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors ${isAnonymous ? "bg-gray-900" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isAnonymous ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-700">Submit anonymously</p>
                  {isAnonymous && (
                    <p className="text-xs text-amber-600 mt-0.5">Anonymous feedback cannot receive replies from HR.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title || !category || !body || submitting}
                className="bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
