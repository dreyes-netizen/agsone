"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Plus, Send, MessageSquarePlus, Loader2, AlertCircle, CheckCircle, EyeOff, AlertTriangle, Pencil, ArrowLeft } from "lucide-react";
import { WhistleIcon } from "@/components/icons/WhistleIcon";

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

type Toast = { type: "success" | "error"; msg: string };

const CATEGORY_LABELS: Record<string, string> = {
  HARASSMENT_DISCRIMINATION: "Harassment & Discrimination",
  ETHICAL_FRAUD:             "Ethical Violations & Fraud",
  MISCONDUCT_ABUSE:          "Workplace Misconduct & Abuse of Authority",
  SECURITY_POLICY:           "Security Concerns & Policy Violations",
  COMPENSATION_BENEFITS: "Compensation & Benefits",
  WORK_LIFE_BALANCE: "Work-Life Balance",
  COMPANY_CULTURE: "Company Culture",
  TEAM_DYNAMICS: "Team Dynamics",
  PROCESSES_TOOLS: "Processes & Tools",
  RECOGNITION: "Recognition",
  OTHER: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  HARASSMENT_DISCRIMINATION: "bg-red-100 text-red-700",
  ETHICAL_FRAUD:             "bg-orange-100 text-orange-700",
  MISCONDUCT_ABUSE:          "bg-amber-100 text-amber-800",
  SECURITY_POLICY:           "bg-rose-100 text-rose-700",
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

function isHrRole(role: string) {
  return role === "HR_ADMIN" || role === "MANAGER";
}

export default function FeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [panel, setPanel] = useState<PanelState>({ mode: "welcome" });
  const [toast, setToast] = useState<Toast | null>(null);

  // Compose state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Thread state
  const [thread, setThread] = useState<FeedbackThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const [prevPanel, setPrevPanel] = useState<PanelState>({ mode: "welcome" });

  function showToast(type: Toast["type"], msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setListLoading(false); return; }
    apiFetch<{ data: FeedbackItem[] }>("/api/feedback")
      .then((r) => setItems(r.data))
      .catch(console.error)
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

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

  // Auto-scroll replies to bottom when new reply is added
  useEffect(() => {
    if (thread?.replies.length) {
      repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.replies.length]);

  function startCompose() {
    if (panel.mode === "compose") return;
    setPrevPanel(panel);
    setTitle(""); setCategory(""); setBody(""); setIsAnonymous(true);
    setPanel({ mode: "compose" });
  }

  function discardCompose() {
    setTitle(""); setCategory(""); setBody(""); setIsAnonymous(true);
    setReplyBody("");
    setPanel(prevPanel);
  }

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
      showToast("success", "Report submitted. HR will follow up.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to submit");
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
      setItems((prev) =>
        prev.map((item) =>
          item.id === thread.id
            ? { ...item, _count: { replies: item._count.replies + 1 }, updatedAt: new Date().toISOString() }
            : item
        )
      );
      setReplyBody("");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to send reply");
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
          <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Confidential — HR &amp; Investigators only</p>
        </div>
        <button
          onClick={startCompose}
          aria-label="New report"
          className="flex items-center gap-2 bg-[#111827] hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New
        </button>
      </div>

      {/* Split panel */}
      <div className="flex flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0">

        {/* Left panel — report list (full-width on mobile when no thread/compose active) */}
        <div
          className={`flex-col overflow-y-auto border-gray-100 md:w-72 md:flex-shrink-0 md:border-r ${
            panel.mode !== "welcome" ? "hidden md:flex" : "flex w-full"
          }`}
          aria-label="Your reports"
        >
          {listLoading ? (
            <div role="status" aria-label="Loading reports" className="p-3 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl motion-safe:animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 && panel.mode !== "compose" ? (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <MessageSquarePlus className="w-5 h-5 text-gray-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No reports yet</p>
              <p className="text-xs text-gray-500 mt-1">Report a concern confidentially</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {panel.mode === "compose" && (
                <div className="bg-[#111827] text-white rounded-xl p-3 border border-dashed border-white/20" aria-current="true">
                  <p className="flex items-center gap-1.5 text-[10px] opacity-60 mb-1">
                    <Pencil className="w-3 h-3" aria-hidden="true" /> New draft
                  </p>
                  <p className="text-xs font-semibold opacity-70 italic truncate">
                    {title || "Untitled report"}
                  </p>
                </div>
              )}
              {items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPanel({ mode: "thread", id: item.id })}
                    aria-pressed={isActive}
                    aria-label={`${item.title}, ${STATUS_LABEL[item.status]}`}
                    className={`w-full text-left rounded-xl p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900/40 ${
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
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${isActive ? "text-white/50" : "text-gray-400"}`}>
                      {item._count.replies} {item._count.replies === 1 ? "reply" : "replies"} ·{" "}
                      {new Date(item.updatedAt).toLocaleDateString()}
                      {item.isAnonymous && (
                        <>
                          {" · "}
                          <EyeOff className="w-3 h-3 inline" aria-hidden="true" />
                          <span className="sr-only">anonymous</span>
                        </>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel (full-width on mobile when thread/compose active; hidden when list is shown) */}
        <div
          className={`flex-col min-w-0 overflow-hidden ${
            panel.mode !== "welcome" ? "flex flex-1" : "hidden md:flex md:flex-1"
          }`}
          aria-live="polite"
          aria-atomic="false"
        >
          {/* Mobile back button — returns to the report list */}
          {panel.mode !== "welcome" && (
            <button
              onClick={() => {
                if (panel.mode === "compose") discardCompose();
                else setPanel({ mode: "welcome" });
              }}
              className="md:hidden flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-4 py-3 border-b border-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900/20"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              All reports
            </button>
          )}

          {panel.mode === "welcome" && (
            <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <WhistleIcon className="w-7 h-7 text-red-500" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-gray-800 mb-2">Confidential Whistleblower Channel</h2>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-4">
                Reports are visible only to HR and authorized investigators. You may submit anonymously.
              </p>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-left w-full max-w-xs mb-6">
                <ul className="text-xs text-red-600 space-y-1 list-disc pl-4">
                  <li>Retaliation is strictly prohibited</li>
                  <li>Anonymous by default</li>
                  <li>False malicious reporting may result in disciplinary action</li>
                </ul>
              </div>
              <button
                onClick={startCompose}
                className="bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-700"
              >
                {items.length === 0 ? "File your first report →" : "+ New Report"}
              </button>
            </div>
          )}

          {panel.mode === "compose" && (
            <div className="p-6 flex flex-col gap-4 max-w-xl overflow-y-auto flex-1 min-h-0">
              <h2 className="text-base font-bold text-gray-900" id="compose-heading">Report a Concern</h2>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-bold text-red-700">Confidential Whistleblower Channel</p>
                <p className="text-xs text-red-600 mt-1">Visible ONLY to HR and authorized investigators.</p>
                <p className="text-xs text-amber-700 font-medium mt-1 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                  Retaliation is strictly prohibited. False malicious reporting may result in disciplinary action.
                </p>
              </div>

              <div>
                <label htmlFor="fb-title" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Title <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="fb-title"
                  type="text"
                  autoFocus
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of your report"
                  aria-required="true"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition"
                />
              </div>

              <div>
                <label htmlFor="fb-category" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Category <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <select
                  id="fb-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-required="true"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 bg-white transition"
                >
                  <option value="">Select a category</option>
                  <option value="HARASSMENT_DISCRIMINATION">Harassment &amp; Discrimination</option>
                  <option value="ETHICAL_FRAUD">Ethical Violations &amp; Fraud</option>
                  <option value="MISCONDUCT_ABUSE">Workplace Misconduct &amp; Abuse of Authority</option>
                  <option value="SECURITY_POLICY">Security Concerns &amp; Policy Violations</option>
                </select>
              </div>

              <div>
                <label htmlFor="fb-body" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Details <span aria-hidden="true" className="text-red-500">*</span>{" "}
                  <span className="font-normal text-gray-400 normal-case">({body.length}/1000)</span>
                </label>
                <textarea
                  id="fb-body"
                  rows={6}
                  maxLength={1000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe the concern in detail. Include dates, names, and any evidence if available."
                  aria-required="true"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none transition"
                />
              </div>

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  aria-label="Submit anonymously"
                  onClick={() => setIsAnonymous((v) => !v)}
                  className={`relative shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-700 ${
                    isAnonymous ? "bg-red-700" : "bg-gray-200"
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
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 rounded-lg"
                >
                  Discard
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title || !category || !body || submitting}
                  aria-busy={submitting}
                  className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-700"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                  {submitting ? "Submitting…" : "Submit Report"}
                </button>
              </div>
            </div>
          )}

          {panel.mode === "thread" && (
            <>
              {threadLoading ? (
                <div role="status" aria-label="Loading thread" className="p-6 space-y-4">
                  <div className="h-5 w-24 bg-gray-100 rounded motion-safe:animate-pulse" />
                  <div className="h-7 w-64 bg-gray-100 rounded motion-safe:animate-pulse" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-100 rounded motion-safe:animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : threadError ? (
                <div className="flex flex-col items-center justify-center flex-1 p-10 text-center" role="alert">
                  <AlertCircle className="w-6 h-6 text-red-500 mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-red-600 mb-1">Failed to load thread</p>
                  <p className="text-xs text-gray-500">{threadError}</p>
                </div>
              ) : !thread ? (
                <div role="status" aria-label="Loading thread" className="p-6 space-y-4">
                  <div className="h-5 w-24 bg-gray-100 rounded motion-safe:animate-pulse" />
                  <div className="h-7 w-64 bg-gray-100 rounded motion-safe:animate-pulse" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-100 rounded motion-safe:animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Thread header */}
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
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              <EyeOff className="w-3 h-3" aria-hidden="true" />
                              Anonymous
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
                        aria-label={`Status: ${STATUS_LABEL[thread.status]}`}
                      >
                        {STATUS_LABEL[thread.status]}
                      </span>
                    </div>
                  </div>

                  {/* Thread body */}
                  <div className="px-6 py-4 border-b border-gray-50 flex-shrink-0">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {thread.body}
                    </p>
                  </div>

                  {/* Replies */}
                  <div className="flex-1 overflow-y-auto px-6 py-4" aria-label="Thread replies">
                    {thread.replies.length === 0 && !thread.isAnonymous && (
                      <p className="text-xs text-gray-400 text-center py-4">
                        No replies yet. HR will respond here.
                      </p>
                    )}
                    <ul className="space-y-4">
                      {thread.replies.map((reply) => {
                        const isHrReply = isHrRole(reply.author.role);
                        return (
                          <li
                            key={reply.id}
                            className={`flex gap-3 ${isHrReply ? "" : "flex-row-reverse"}`}
                          >
                            <div
                              className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden"
                              aria-hidden="true"
                            >
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
                                className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                                  isHrReply
                                    ? "bg-gray-100 text-gray-800 rounded-tl-none"
                                    : "bg-[#111827] text-white rounded-tr-none"
                                }`}
                              >
                                {reply.body}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div ref={repliesEndRef} />
                  </div>

                  {/* Reply input */}
                  <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
                    {thread.isAnonymous ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800">
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> Anonymous submission
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          HR cannot reply to anonymous feedback. Your identity is protected.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex gap-3 items-end">
                          <label htmlFor="reply-input" className="sr-only">Reply to HR</label>
                          <textarea
                            id="reply-input"
                            rows={2}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply();
                            }}
                            placeholder="Reply to HR…"
                            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 resize-none transition"
                          />
                          <button
                            onClick={handleReply}
                            disabled={!replyBody.trim() || sending}
                            aria-label="Send reply"
                            className="flex items-center justify-center w-10 h-10 bg-[#111827] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                          >
                            {sending
                              ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                              : <Send className="w-4 h-4" aria-hidden="true" />
                            }
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 pl-1">Ctrl + Enter to send</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" aria-hidden="true" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
