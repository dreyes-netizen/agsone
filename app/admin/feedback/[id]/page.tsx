"use client";

import { useEffect, useState, use } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { WhistleIcon } from "@/components/icons/WhistleIcon";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants/feedbackCategories";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";

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
  author: { displayName: string; avatarUrl: string | null } | null;
  replies: Reply[];
};

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "RESOLVED", label: "Resolved" },
];

const STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-gray-100 text-gray-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

export default function AdminFeedbackThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const [thread, setThread] = useState<FeedbackThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [realtimeTopic, setRealtimeTopic] = useState<string | null>(null);

  async function load() {
    try {
      const r = await apiFetch<{ data: FeedbackThread; realtimeTopic: string }>(`/api/admin/feedback/${id}`);
      setThread(r.data);
      setRealtimeTopic(r.realtimeTopic);
    } catch {
      router.push("/admin/feedback");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(load);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, id]);

  useRealtimeChannel(realtimeTopic, load, { debounceMs: 150 });

  async function handleStatusChange(status: string) {
    if (!thread) return;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setThread((prev) => prev ? { ...prev, status: status as FeedbackThread["status"] } : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleReply() {
    if (!replyBody.trim() || !thread) return;
    setSending(true);
    try {
      const res = await apiFetch<{ data: Reply }>(`/api/admin/feedback/${id}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody }),
      });
      setThread((prev) => prev
        ? { ...prev, replies: [...prev.replies, res.data], status: prev.status === "OPEN" ? "IN_REVIEW" : prev.status }
        : prev);
      setReplyBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  if (loading) return (
    <div className="p-8 text-gray-500 flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      Loading...
    </div>
  );
  if (!thread) return null;

  const isHrRole = (role: string) => role === "HR_ADMIN" || role === "MANAGER";

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => router.push("/admin/feedback")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to Whistleblower Reports
      </button>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
          <WhistleIcon className="w-4 h-4 text-red-600" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Whistleblower Report</h2>
          <p className="text-xs text-red-600 font-medium">Confidential — HR & Investigators only</p>
        </div>
      </div>

      {/* Original submission */}
      <div className="bg-white rounded-card border border-table-border p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" aria-hidden="true" /> Confidential
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[thread.category] ?? "bg-gray-100 text-gray-600"}`}>
                {CATEGORY_LABELS[thread.category] ?? thread.category}
              </span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{thread.title}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {thread.isAnonymous ? "Anonymous Employee" : (thread.author?.displayName ?? "Unknown")}
              </span>
              <span>·</span>
              <span>{new Date(thread.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CHIP[thread.status]}`}>
              {thread.status === "IN_REVIEW" ? "In Review" : thread.status === "OPEN" ? "Open" : "Resolved"}
            </span>
            <select
              value={thread.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
              aria-label="Change report status"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{thread.body}</p>
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div className="space-y-3">
          {thread.replies.map((reply) => {
            const isHr = isHrRole(reply.author.role);
            return (
              <div key={reply.id} className={`flex gap-3 ${isHr ? "flex-row-reverse" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden">
                  {reply.author.avatarUrl
                    ? <img src={reply.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : reply.author.displayName.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[75%] space-y-1`}>
                  <div className={`flex items-center gap-2 ${isHr ? "flex-row-reverse" : ""}`}>
                    <span className="text-xs font-semibold text-gray-700">{reply.author.displayName}</span>
                    <span className="text-[10px] text-gray-500">{new Date(reply.createdAt).toLocaleString()}</span>
                  </div>
                  <div className={`px-4 py-3 rounded-2xl text-sm text-gray-800 whitespace-pre-wrap ${isHr ? "bg-command-black text-white rounded-tr-none" : "bg-gray-100 rounded-tl-none"}`}>
                    {reply.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input */}
      {thread.isAnonymous ? (
        <p className="text-xs text-gray-500 text-center py-2 bg-gray-50 rounded-xl border border-gray-100">
          Cannot reply to anonymous feedback
        </p>
      ) : (
        <div className="bg-white rounded-card border border-table-border p-4 flex gap-3 items-end">
          <textarea
            rows={2}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply to the employee..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
          />
          <button
            onClick={handleReply}
            disabled={!replyBody.trim() || sending}
            aria-label="Send reply"
            className="flex items-center justify-center w-10 h-10 bg-command-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
