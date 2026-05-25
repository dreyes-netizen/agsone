"use client";

import { useEffect, useState, use } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

type Reply = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null; role: string };
};

type FeedbackThread = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  isAnonymous: boolean;
  createdAt: string;
  replies: Reply[];
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

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
};

export default function FeedbackThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [thread, setThread] = useState<FeedbackThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: FeedbackThread }>(`/api/feedback/${id}`)
      .then((r) => setThread(r.data))
      .catch(() => router.push("/feedback"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, id]);

  async function handleReply() {
    if (!replyBody.trim() || !thread) return;
    setSending(true);
    try {
      const res = await apiFetch<{ data: Reply }>(`/api/feedback/${id}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody }),
      });
      setThread((prev) => prev ? { ...prev, replies: [...prev.replies, res.data] } : prev);
      setReplyBody("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!thread) return null;

  const isHrRole = (role: string) => role === "HR_ADMIN" || role === "MANAGER";

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => router.push("/feedback")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to My Feedback
      </button>

      {/* Original submission */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {CATEGORY_LABELS[thread.category]}
              </span>
              {thread.isAnonymous && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Anonymous</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-gray-900">{thread.title}</h1>
            <p className="text-xs text-gray-400">{new Date(thread.createdAt).toLocaleString()}</p>
          </div>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CHIP[thread.status]}`}>
            {STATUS_LABEL[thread.status]}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{thread.body}</p>
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="space-y-3">
          {thread.replies.map((reply) => {
            const isHr = isHrRole(reply.author.role);
            return (
              <div key={reply.id} className={`flex gap-3 ${isHr ? "" : "flex-row-reverse"}`}>
                <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden">
                  {reply.author.avatarUrl
                    ? <img src={reply.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : reply.author.displayName.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[75%] space-y-1 ${isHr ? "" : "items-end"}`}>
                  <div className={`flex items-center gap-2 ${isHr ? "" : "flex-row-reverse"}`}>
                    <span className="text-xs font-semibold text-gray-700">
                      {isHr ? "HR Team" : "You"}
                    </span>
                    <span className="text-[10px] text-gray-400">{new Date(reply.createdAt).toLocaleString()}</span>
                  </div>
                  <div className={`px-4 py-3 rounded-2xl text-sm text-gray-800 ${isHr ? "bg-gray-100 rounded-tl-none" : "bg-[#111827] text-white rounded-tr-none"}`}>
                    {reply.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input — hidden if anonymous */}
      {!thread.isAnonymous && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-end">
          <textarea
            rows={2}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
          />
          <button
            onClick={handleReply}
            disabled={!replyBody.trim() || sending}
            className="flex items-center justify-center w-10 h-10 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {thread.isAnonymous && (
        <p className="text-xs text-gray-400 text-center">This feedback was submitted anonymously. Replies are not available.</p>
      )}
    </div>
  );
}
