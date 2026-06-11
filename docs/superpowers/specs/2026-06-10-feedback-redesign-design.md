# Feedback Page Redesign Design Spec
_Date: 2026-06-10_

## Goal

Redesign the existing `/feedback` employee page from a two-page (list + separate thread page) layout into a single-page split-panel layout. The redesign improves visual cohesion with the rest of the app, eliminates jarring page transitions, and gives the feedback feature a more polished, purposeful feel without changing any backend logic.

---

## Context

The feedback feature was fully implemented (May 2026) with a working ticket-inbox model: employees submit structured feedback to HR, HR replies in threaded conversations, statuses track through OPEN → IN_REVIEW → RESOLVED. The backend (API routes, schema, notifications) is complete and stays untouched. This spec covers only the employee-facing UI at `/feedback` and `/feedback/[id]`.

---

## What Changes

| Before | After |
|---|---|
| `/feedback` list page + separate `/feedback/[id]` thread page | Single `/feedback` page with split panel |
| No status filter tabs | Status filter built into left panel (future) |
| Submit via modal overlay | Submit form loads in right panel |
| Plain cards, no category accent | Category pill + status pill per list item |
| No empty state personality | Branded empty state with CTA on right panel |
| Anonymous feedback: reply input hidden | Anonymous notice shown in right panel instead |

---

## Architecture

Single route: `app/(dashboard)/feedback/page.tsx`. The component manages three right-panel modes via a `panel` state discriminated union:

```ts
type PanelState =
  | { mode: "welcome" }            // nothing selected (whether 0 threads or just none clicked)
  | { mode: "compose" }            // new feedback form
  | { mode: "thread"; id: string } // viewing a thread
```

The existing API routes remain unchanged:
- `GET /api/feedback` — fetch list
- `POST /api/feedback` — create new submission
- `GET /api/feedback/[id]` — fetch thread
- `POST /api/feedback/[id]/replies` — post employee reply

The existing `app/(dashboard)/feedback/[id]/page.tsx` is deleted — that route is no longer needed.

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [My Feedback]                              [+ New]          │
├──────────────────┬──────────────────────────────────────────┤
│  Left panel      │  Right panel                             │
│  (fixed 280px)   │  (flex-1)                                │
│                  │                                          │
│  List of         │  Switches between:                       │
│  feedback items  │  • Welcome / empty state                 │
│  or empty state  │  • New feedback form                     │
│                  │  • Thread view                           │
│                  │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

The left panel is a fixed `280px` wide column separated by a `border-r`. The right panel fills the rest. Both panels scroll independently.

---

## Left Panel

### List item anatomy
Each item shows:
- Category pill (colored, top-left)
- Status pill (top-right): gray = Open, amber = In Review, green = Resolved
- Title (truncated at 2 lines)
- Meta line: `{n} replies · {relative time}`

**Active state:** full dark fill (`bg-[#111827] text-white`), pills adapt to white-tinted variants.

**Anonymous badge:** shown on the item if `isAnonymous === true` (ghost pill).

### Empty left state
When no threads exist:
- Chat bubble icon (💬) centered
- "No feedback yet" heading
- "Share something with HR privately" subtext

### Header
- "My Feedback" title left, `+ New` dark button right
- Clicking `+ New` sets panel to `compose` mode and highlights a draft item in the list

---

## Right Panel

### Welcome state (nothing selected)
Shown whenever `panel.mode === "welcome"` — covers both an empty list and threads existing but none clicked yet.
- Inbox icon (📬) centered
- Heading: "Your private channel to HR"
- Body: "Submit feedback on any topic. HR will review and reply. You can submit anonymously."
- CTA button: "Submit your first feedback →" — clicking this triggers `compose` mode
- When threads already exist, the CTA reads "+ New Feedback" instead

### Compose mode
Shown when `+ New` is clicked. A draft placeholder item appears in the left list.

Fields:
- **Title** — text input, required, max 150 chars, autofocused
- **Category** — select dropdown, required
- **Details** — textarea, required, max 1000 chars, live char counter `(n/1000)`
- **Anonymous toggle** — when on, shows amber inline warning: *"Anonymous feedback cannot receive replies from HR."*

Actions (bottom row):
- **Discard** — removes draft item from left list, returns right panel to previous state
- **Submit** — disabled (opacity-40) until title + category + details all filled; on success, new item appears in list and thread view opens

### Thread mode
Shown when a list item is clicked.

**Header:**
- Category pill + title
- Status pill (read-only for employees)
- Submission date

**Original body:** rendered below the header, separated by a divider.

**Chat thread:**
- HR replies: left-aligned, gray bubble (`bg-gray-100`), avatar with "HR" initials, labeled "HR Team"
- Employee replies: right-aligned, dark bubble (`bg-[#111827] text-white`), labeled "You"
- Timestamps on each bubble

**Reply input (non-anonymous only):**
- Textarea + send button (↑ icon, dark)
- Disabled + hidden if `isAnonymous === true`

**Anonymous notice (anonymous threads only):**
- Amber/yellow notice box at bottom: "Anonymous submission — HR cannot reply. Your identity is protected."

---

## States Summary

| State | Left panel | Right panel |
|---|---|---|
| Loading | Skeleton pulses | — |
| Empty, no compose | Empty state (icon + text) | Welcome state (no-threads CTA) |
| Has threads, none selected | Thread list | Welcome state (generic CTA) |
| Thread selected | Thread list, item active | Thread view |
| Composing new feedback | Draft item highlighted | Compose form |
| Anonymous thread selected | Thread list, item active | Thread view, no reply, amber notice |

---

## Visual Details

### Category colors (pills)
| Category | Colors |
|---|---|
| COMPENSATION_BENEFITS | `bg-emerald-100 text-emerald-700` |
| WORK_LIFE_BALANCE | `bg-sky-100 text-sky-700` |
| COMPANY_CULTURE | `bg-indigo-100 text-indigo-700` |
| TEAM_DYNAMICS | `bg-orange-100 text-orange-700` |
| PROCESSES_TOOLS | `bg-gray-100 text-gray-700` |
| RECOGNITION | `bg-amber-100 text-amber-700` |
| OTHER | `bg-zinc-100 text-zinc-600` |

### Status pills
| Status | Colors |
|---|---|
| OPEN | `bg-gray-100 text-gray-600` |
| IN_REVIEW | `bg-amber-100 text-amber-700` |
| RESOLVED | `bg-emerald-100 text-emerald-700` |

### Active item pill variants (on dark bg)
- Category: `bg-white/15 text-white`
- Status (In Review): `bg-amber-400 text-amber-900`
- Status (Open): `bg-white/10 text-white/70`
- Status (Resolved): `bg-emerald-400 text-emerald-900`

---

## File Changes

| File | Action |
|---|---|
| `app/(dashboard)/feedback/page.tsx` | Rewrite — full split-panel component |
| `app/(dashboard)/feedback/[id]/page.tsx` | Delete — route no longer needed |

All API routes, schema, and admin UI are unchanged.

---

## Out of Scope

- Admin UI changes (`/admin/feedback` stays as-is)
- Status filter tabs in the left panel (future enhancement)
- Mobile/responsive layout (internal app, desktop-first)
- Read receipts or unread indicators
