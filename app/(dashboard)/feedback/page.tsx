"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Plus, Send, Inbox, MessageSquarePlus } from "lucide-react";

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

type PanelState =
  | { mode: "welcome" }
  | { mode: "compose" }
  | { mode: "thread"; id: string };

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
  COMPANY_CULTURE: "bg-indigo-100 text-indigo-700",
  TEAM_DYNAMICS: "bg-orange-100 text-orange-700",
  PROCESSES_TOOLS: "bg-gray-100 text-gray-700",
  RECOGNITION: "bg-amber-100 text-amber-700",
  OTHER: "bg-zinc-100 text-zinc-600",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
};

const STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-gray-100 text-gray-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

// MIN-1: moved to module level
function isHrRole(role: string) {
  return role === "HR_ADMIN" || role === "MANAGER";
}

export default function FeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [panel, setPanel] = useState<PanelState>({ mode: "welcome" });

  // Compose state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Thread state
  const [thread, setThread] = useState<FeedbackThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null); // CR-2
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // CR-3: remember previous panel before entering compose
  const [prevPanel, setPrevPanel] = useState<PanelState>({ mode: "welcome" });

  // CR-1: clear listLoading when auth is done but user is null
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setListLoading(false); return; }
    apiFetch<{ data: FeedbackItem[] }>("/api/feedback")
      .then((r) => setItems(r.data))
      .catch(console.error)
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // CR-2: surface thread fetch errors instead of swallowing them
  useEffect(() => {
    if (panel.mode !== "thread") { setThread(null); setThreadError(null); return; }
    setThreadLoading(true);
    setThreadError(null);
    apiFetch<{ data: FeedbackThread }>(`/api/feedback/${panel.id}`)
      .then((r) => setThread(r.data))
      .catch((err) => setThreadError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setThreadLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  // CR-3: save current panel before switching to compose
  function startCompose() {
    setPrevPanel(panel);
    setTitle(""); setCategory(""); setBody(""); setIsAnonymous(false);
    setPanel({ mode: "compose" });
  }

  // CR-3 + IMP-3: restore previous panel and clear replyBody on discard
  function discardCompose() {
    setTitle(""); setCategory(""); setBody(""); setIsAnonymous(false);
    setReplyBody("");
    setPanel(prevPanel);
  }

  // IMP-6: Escape key dismisses compose
  useEffect(() => {
    if (panel.mode !== "compose") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") discardCompose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.mode]);

  async function handleSubmit() {
    if (!title || !category || !body || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: FeedbackItem }>("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ title, category, body, isAnonymous }),
      });
      setItems((prev) => [{ ...res.data, _count: { replies: 0 } }, ...prev]);
      setPanel({ mode: "thread", id: res.data.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply() {
    if (!replyBody.trim() || !thread || sending) return;
    setSending(true);
    try {
      const res = await apiFetch<{ data: Reply }>(`/api/feedback/${thread.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody }),
      });
      setThread((prev) => prev ? { ...prev, replies: [...prev.replies, res.data] } : prev);
      // IMP-1: update reply count in left panel list
      setItems((prev) =>
        prev.map((item) =>
          item.id === thread.id
            ? { ...item, _count: { replies: item._count.replies + 1 }, updatedAt: new Date().toISOString() }
            : item
        )
      );
      setReplyBody("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const activeId = panel.mode === "thread" ? panel.id : null;

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Feedback</h1>
          <p className="text-sm text-gray-400 mt-0.5">Private channel to HR</p>
        </div>
        <button
          onClick={startCompose}
          className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {/* Split panel */}
      <div className="flex flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0">

        {/* Left panel */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 flex flex-col overflow-y-auto">
          {listLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 && panel.mode !== "compose" ? (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <MessageSquarePlus className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No feedback yet</p>
              <p className="text-xs text-gray-400 mt-1">Share something with HR privately</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {panel.mode === "compose" && (
                <div className="bg-[#111827] text-white rounded-xl p-3 border border-dashed border-white/20">
                  <p className="text-[10px] opacity-60 mb-1">✏️ New draft</p>
                  <p className="text-xs font-semibold opacity-70 italic truncate">
                    {title || "Untitled feedback"}
                  </p>
                </div>
              )}
              {items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPanel({ mode: "thread", id: item.id })}
                    className={`w-full text-left rounded-xl p-3 transition-colors ${
                      isActive ? "bg-[#111827]" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[110px] ${
                          isActive ? "bg-white/15 text-white" : CATEGORY_COLORS[item.category]
                        }`}
                      >
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isActive
                            ? item.status === "IN_REVIEW"
                              ? "bg-amber-400 text-amber-900"
                              : item.status === "RESOLVED"
                              ? "bg-emerald-400 text-emerald-900"
                              : "bg-white/10 text-white/70"
                            : STATUS_CHIP[item.status]
                        }`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <p
                      className={`text-xs font-semibold line-clamp-2 ${
                        isActive ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className={`text-[10px] mt-1 ${isActive ? "text-white/50" : "text-gray-400"}`}>
                      {item._count.replies} {item._count.replies === 1 ? "reply" : "replies"} ·{" "}
                      {new Date(item.updatedAt).toLocaleDateString()}
                      {item.isAnonymous && " · 👤"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {panel.mode === "welcome" && (
            <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 text-gray-400" />
              </div>
              <h2 className="text-base font-bold text-gray-800 mb-2">Your private channel to HR</h2>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-6">
                Submit feedback on any topic. HR will review and reply. You can submit anonymously.
              </p>
              <button
                onClick={startCompose}
                className="bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {items.length === 0 ? "Submit your first feedback →" : "+ New Feedback"}
              </button>
            </div>
          )}

          {/* IMP-4: flex-1 min-h-0 so compose scrolls on short viewports */}
          {panel.mode === "compose" && (
            <div className="p-6 flex flex-col gap-4 max-w-xl overflow-y-auto flex-1 min-h-0">
              <h2 className="text-base font-bold text-gray-900">New Feedback</h2>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  autoFocus
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white"
                >
                  <option value="">Select a category</option>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Details{" "}
                  <span className="font-normal text-gray-400 normal-case">({body.length}/1000)</span>
                </label>
                <textarea
                  rows={6}
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
                  className={`relative shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors ${
                    isAnonymous ? "bg-gray-900" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      isAnonymous ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-gray-700">Submit anonymously</p>
                  {isAnonymous && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Anonymous feedback cannot receive replies from HR.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={discardCompose}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title || !category || !body || submitting}
                  className="bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </div>
          )}

          {panel.mode === "thread" && (
            <>
              {/* CR-2: separate loading / error / empty / content states */}
              {threadLoading ? (
                <div className="p-6 space-y-4">
                  <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-7 w-64 bg-gray-100 rounded animate-pulse" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : threadError ? (
                <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
                  <p className="text-sm font-semibold text-red-600 mb-2">Failed to load thread</p>
                  <p className="text-xs text-gray-400">{threadError}</p>
                </div>
              ) : !thread ? null : (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-6 pb-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              CATEGORY_COLORS[thread.category]
                            }`}
                          >
                            {CATEGORY_LABELS[thread.category]}
                          </span>
                          {thread.isAnonymous && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              👤 Anonymous
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-gray-900">{thread.title}</h2>
                        <p className="text-xs text-gray-400 mt-1">
                          Submitted {new Date(thread.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          STATUS_CHIP[thread.status]
                        }`}
                      >
                        {STATUS_LABEL[thread.status]}
                      </span>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-b border-gray-50 flex-shrink-0">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {thread.body}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {thread.replies.length === 0 && !thread.isAnonymous && (
                      <p className="text-xs text-gray-400 text-center py-4">
                        No replies yet. HR will respond here.
                      </p>
                    )}
                    {thread.replies.map((reply) => {
                      const isHrReply = isHrRole(reply.author.role);
                      return (
                        <div
                          key={reply.id}
                          className={`flex gap-3 ${isHrReply ? "" : "flex-row-reverse"}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden">
                            {reply.author.avatarUrl ? (
                              <img
                                src={reply.author.avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              reply.author.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="max-w-[75%] space-y-1">
                            <div
                              className={`flex items-center gap-2 ${
                                isHrReply ? "" : "flex-row-reverse"
                              }`}
                            >
                              <span className="text-xs font-semibold text-gray-700">
                                {isHrReply ? "HR Team" : "You"}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(reply.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div
                              className={`px-4 py-3 rounded-2xl text-sm ${
                                isHrReply
                                  ? "bg-gray-100 text-gray-800 rounded-tl-none"
                                  : "bg-[#111827] text-white rounded-tr-none"
                              }`}
                            >
                              {reply.body}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                    {thread.isAnonymous ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                        <p className="text-xs font-semibold text-amber-800">👤 Anonymous submission</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          HR cannot reply to anonymous feedback. Your identity is protected.
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-3 items-end">
                        <textarea
                          rows={2}
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          // IMP-2: Enter submits reply (Shift+Enter for newline)
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleReply();
                            }
                          }}
                          placeholder="Reply to HR..."
                          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
                        />
                        <button
                          onClick={handleReply}
                          disabled={!replyBody.trim() || sending}
                          className="flex items-center justify-center w-10 h-10 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
