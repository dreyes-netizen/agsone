# Feedback Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-page feedback UI (`/feedback` list + `/feedback/[id]` thread) with a single split-panel page where the left column lists threads and the right column shows the active thread, compose form, or a welcome state.

**Architecture:** One `page.tsx` file manages a `PanelState` discriminated union (`welcome | compose | thread`). The left panel is a fixed 288px list; the right panel renders one of three modes. All existing API routes are unchanged — this is a UI-only rewrite.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, `useApiClient` hook, `useAuth` hook, Lucide icons.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `app/(dashboard)/feedback/page.tsx` | Rewrite | Full split-panel component |
| `app/(dashboard)/feedback/[id]/page.tsx` | Delete | Route no longer needed |

---

## Task 1: Delete Old Thread Route

**Files:**
- Delete: `app/(dashboard)/feedback/[id]/page.tsx`

- [ ] **Step 1: Check for direct links to `/feedback/[id]`**

Search the codebase for any hardcoded links to the old thread route:

```powershell
grep -r "feedback/" app --include="*.tsx" --include="*.ts" -l
```

If any file other than `app/(dashboard)/feedback/[id]/page.tsx` links to `/feedback/[id]`, update those links to `/feedback` before deleting.

- [ ] **Step 2: Delete the file**

```powershell
Remove-Item "app/(dashboard)/feedback/[id]/page.tsx"
```

- [ ] **Step 3: Verify TypeScript still compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors related to the deleted file.

- [ ] **Step 4: Commit**

```powershell
git add "app/(dashboard)/feedback/[id]/page.tsx"
git commit -m "chore: remove /feedback/[id] route — replaced by split-panel page"
```

---

## Task 2: Rewrite Feedback Page — Full Split-Panel Component

**Files:**
- Modify: `app/(dashboard)/feedback/page.tsx`

This is a complete file replacement. The steps below build the component incrementally so each save produces a working (if partial) state.

- [ ] **Step 1: Replace the entire file**

Open `app/(dashboard)/feedback/page.tsx` and replace all content with the following:

```typescript
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
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: FeedbackItem[] }>("/api/feedback")
      .then((r) => setItems(r.data))
      .catch(console.error)
      .finally(() => setListLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (panel.mode !== "thread") { setThread(null); return; }
    setThreadLoading(true);
    apiFetch<{ data: FeedbackThread }>(`/api/feedback/${panel.id}`)
      .then((r) => setThread(r.data))
      .catch(console.error)
      .finally(() => setThreadLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  function startCompose() {
    setTitle(""); setCategory(""); setBody(""); setIsAnonymous(false);
    setPanel({ mode: "compose" });
  }

  function discardCompose() {
    setTitle(""); setCategory(""); setBody(""); setIsAnonymous(false);
    setPanel({ mode: "welcome" });
  }

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
      setReplyBody("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const activeId = panel.mode === "thread" ? panel.id : null;
  const isHrRole = (role: string) => role === "HR_ADMIN" || role === "MANAGER";

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

        {/* ─── Left panel ─── */}
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
              {/* Draft placeholder when composing */}
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

        {/* ─── Right panel ─── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Welcome mode */}
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

          {/* Compose mode */}
          {panel.mode === "compose" && (
            <div className="p-6 flex flex-col gap-4 max-w-xl overflow-y-auto">
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

          {/* Thread mode */}
          {panel.mode === "thread" && (
            <>
              {threadLoading || !thread ? (
                <div className="p-6 space-y-4">
                  <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-7 w-64 bg-gray-100 rounded animate-pulse" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
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

                  {/* Original body */}
                  <div className="px-6 py-4 border-b border-gray-50 flex-shrink-0">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {thread.body}
                    </p>
                  </div>

                  {/* Replies */}
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

                  {/* Reply area */}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors. If you see `MessageSquarePlus not found`, confirm it exists in your installed version:
```powershell
node -e "const {MessageSquarePlus} = require('lucide-react'); console.log(!!MessageSquarePlus)"
```
If it returns `false`, replace `MessageSquarePlus` with `MessageSquare` throughout the file.

- [ ] **Step 3: Start dev server and verify State 1 — empty list**

```powershell
npm run dev
```

Navigate to `http://localhost:3000/feedback` while logged in as an employee with no existing feedback.

Expected:
- Left panel: chat bubble icon, "No feedback yet" text
- Right panel: inbox icon, "Your private channel to HR", "Submit your first feedback →" button

- [ ] **Step 4: Verify State 2 — compose form**

Click `+ New` in the page header (or "Submit your first feedback →").

Expected:
- Left panel: dark draft item appears at top, showing "✏️ New draft" + "Untitled feedback" (italic)
- Right panel: "New Feedback" heading with Title, Category, Details fields
- Submit button is disabled (opacity dimmed) until all three fields are filled
- Typing in the Title field updates the draft label in the left panel in real time
- Anonymous toggle shows amber warning when turned on
- Discard button returns to welcome state and clears the left panel draft

- [ ] **Step 5: Verify State 3 — submit and thread view**

Fill in Title, Category, and Details in the compose form and click Submit.

Expected:
- New item appears at top of left panel list (with category pill + "Open" status pill)
- Right panel switches to thread view showing the submitted title, category pill, status pill, original body text
- "No replies yet. HR will respond here." placeholder shown in replies area
- Reply textarea + send button visible at bottom

- [ ] **Step 6: Verify State 4 — existing thread selection**

If you have existing feedback threads, click one in the left panel.

Expected:
- Clicked item gets dark `bg-[#111827]` fill; pills adapt to white-tinted variants
- Right panel loads the thread (skeleton pulses briefly while fetching)
- HR replies appear left-aligned in gray bubbles; employee replies right-aligned in dark bubbles
- Each bubble shows "HR Team" or "You" + timestamp

- [ ] **Step 7: Verify State 5 — anonymous thread**

If you have an anonymous feedback submission, click it.

Expected:
- "👤 Anonymous" pill appears next to the category pill in the thread header
- Amber notice box at bottom: "HR cannot reply to anonymous feedback. Your identity is protected."
- No reply textarea

- [ ] **Step 8: Commit**

```powershell
git add "app/(dashboard)/feedback/page.tsx"
git commit -m "feat(feedback): redesign as split-panel — list + inline thread/compose"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Split panel layout with 288px left column — implemented
- ✅ PanelState: `welcome | compose | thread` — implemented as discriminated union
- ✅ Left panel: category pill + status pill + active dark fill — implemented
- ✅ Left panel: loading skeleton — implemented
- ✅ Left panel: empty state (icon + text) — implemented
- ✅ Left panel: draft placeholder item when composing — implemented
- ✅ Right panel welcome state: inbox icon, CTA adapts to empty/non-empty list — implemented
- ✅ Right panel compose: title/category/details fields, char counter, anon toggle, discard button, disabled submit — implemented
- ✅ Right panel thread: header with category+status pills, original body, HR/employee chat bubbles — implemented
- ✅ Right panel thread: "No replies yet" placeholder — implemented
- ✅ Right panel thread: reply input hidden for anonymous, amber notice shown — implemented
- ✅ Delete old `/feedback/[id]` route — Task 1
- ✅ All API routes unchanged — confirmed (no API changes in this plan)
