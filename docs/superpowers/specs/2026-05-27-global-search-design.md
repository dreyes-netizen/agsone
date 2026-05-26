# Global Search — Design Spec

**Date:** 2026-05-27
**Feature:** Cmd+K command palette for searching employees

---

## Overview

A keyboard-triggered search overlay that lets any authenticated user quickly look up colleagues by name or email. Scope is intentionally narrow: employees only, no navigation on click — the result card surfaces enough context (name, dept, role, email) inline.

---

## Architecture

### API — `GET /api/search?q=`

- Auth: any authenticated user (`verifyAuth`)
- Query param `q`: trimmed, min 2 chars to trigger DB query
- Queries `User` table with Prisma `contains` (case-insensitive) on `displayName` OR `email`
- Filters `isActive: true` only
- Returns top 10 results, ordered by `displayName` ascending
- Response shape:
  ```json
  {
    "data": [
      {
        "id": "...",
        "displayName": "Jane Doe",
        "email": "jane@example.com",
        "avatarUrl": null,
        "role": "EMPLOYEE",
        "department": { "id": "...", "name": "Engineering" }
      }
    ]
  }
  ```
- If `q` is missing or < 2 chars: return `{ "data": [] }` (no DB query)
- No pagination — 10 results is sufficient for a command palette

### UI — `CommandPalette` component

- Lives at `components/CommandPalette.tsx`
- Controlled by `open` / `onClose` props
- Renders as a full-screen backdrop + centered modal (max-w-lg)
- Text input autofocused on open
- Debounced fetch: 300ms after last keystroke, calls `GET /api/search?q=`
- Loading state: subtle spinner in the input trailing area
- Empty state (query < 2 chars): hint text "Type at least 2 characters"
- No results: "No employees found for '{q}'"
- Result row: avatar (initial fallback) + displayName + dept badge + role badge + email
- No click action (informational display only)
- Keyboard: `Escape` closes, `ArrowUp/Down` moves focus between results (standard palette UX)
- Mounted in `app/(dashboard)/layout.tsx` — global across all dashboard pages

### Keyboard Shortcut

- `keydown` listener on `window` inside dashboard layout
- Triggers on `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac): `(e.ctrlKey || e.metaKey) && e.key === "k"`
- Prevents default to avoid browser bookmark shortcut collision
- `useState<boolean>` for `paletteOpen` in layout

---

## Data Flow

```
User presses Cmd+K
  → layout sets paletteOpen = true
  → CommandPalette mounts with open=true
  → user types → 300ms debounce → GET /api/search?q=
  → API queries User table → returns ≤10 results
  → results render in palette
User presses Escape or clicks backdrop
  → onClose → paletteOpen = false
```

---

## File Map

| File | Action |
|------|--------|
| `app/api/search/route.ts` | New — GET handler |
| `components/CommandPalette.tsx` | New — palette UI |
| `app/(dashboard)/layout.tsx` | Modify — mount palette + keyboard shortcut |

---

## Error Handling

- API errors: palette shows "Search unavailable" inline, does not crash
- Empty query: returns early, no DB hit
- SSR: `CommandPalette` is `"use client"`, no server rendering concerns

---

## Non-Goals

- No search across missions, rewards, or feed posts
- No click-to-navigate (future enhancement)
- No fuzzy/typo-tolerant matching — Prisma `contains` is sufficient
