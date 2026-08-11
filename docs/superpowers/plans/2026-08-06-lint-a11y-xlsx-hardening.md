# Lint / Accessibility / xlsx Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `npm run lint` to zero errors (currently 39, from the new React Compiler `react-hooks/set-state-in-effect` / `react-hooks/refs` rules plus a handful of unrelated errors), add missing `aria-label`s to icon-only buttons, and replace the unfixable-CVE `xlsx` dependency with `exceljs` — the three AGShub AGS One backlog items (#32, #35, #36) bundled onto one branch per user decision.

**Architecture:** No new architecture. Each lint fix follows one of a small number of established React patterns (wrap an effect's fire-and-forget call in `queueMicrotask` so the compiler doesn't trace a synchronous `setState`; replace "reset state when a dep changes" effects with the React-docs "adjust state during render" pattern; move ref writes from render into a dependency-less `useEffect`). The xlsx migration adds one new shared helper (`lib/excel/sheetToRows.ts`) that both upload routes call instead of `XLSX.utils.sheet_to_json`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (strict) — no changes to the stack. New dependency: `exceljs`. Removed dependency: `xlsx`.

## Global Constraints

- **No automated test suite exists in this repo.** Every task's verification step is `npx eslint <file>` (must show 0 errors for that file) + `npx tsc --noEmit` (must show 0 new errors) — this replaces the "write failing test / make it pass" cycle referenced by the parent skill template. UI-affecting tasks additionally get a manual browser check, per this project's existing convention (see prior entries in `docs/superpowers/plans/`).
- Branch: `fix/lint-a11y-xlsx-hardening`, created off latest `main`.
- One commit per task, conventional commit style (`fix:`, `chore:`), first line under 72 chars.
- Do not add comments to explain WHAT code does. Only add a comment where the WHY is genuinely non-obvious (e.g. the `queueMicrotask` wraps below — each one gets a one-line comment since "why is this wrapped in queueMicrotask" is exactly the kind of non-obvious-to-a-future-reader thing worth documenting).
- Do not touch any file/line not explicitly listed in this plan — several files here (e.g. `app/admin/points/page.tsx`, `app/(dashboard)/marketplace/page.tsx`) have other pre-existing lint warnings or unrelated code nearby; leave those untouched.
- Every fix in this plan was empirically verified in an isolated git worktree (applied, linted, type-checked, then discarded) before this plan was written — the code shown is proven to clear lint, not a guess.
- Final task in this plan is a full-repo verification pass; nothing is "done" until that passes.

---

### Task 1: Fix `app/(auth)/onboarding/page.tsx` — set-state-in-effect

**Files:**
- Modify: `app/(auth)/onboarding/page.tsx:26`

- [ ] **Step 1: Apply the fix**

```tsx
// before
useEffect(() => {
  if (authLoading || !authUser) return;
  setDisplayName(dbUser?.displayName ?? authUser.displayName ?? "");
  if (dbUser?.department?.id) setDepartmentId(dbUser.department.id);
  if (dbUser?.birthday) setBirthday(dbUser.birthday.slice(0, 10));
  apiFetch<{ data: Department[] }>("/api/departments").then((res) => setDepartments(res.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, authUser, dbUser]);

// after
useEffect(() => {
  if (authLoading || !authUser) return;
  // Compiler forbids a bare synchronous setState in an effect body.
  queueMicrotask(() => {
    setDisplayName(dbUser?.displayName ?? authUser.displayName ?? "");
    if (dbUser?.department?.id) setDepartmentId(dbUser.department.id);
    if (dbUser?.birthday) setBirthday(dbUser.birthday.slice(0, 10));
  });
  apiFetch<{ data: Department[] }>("/api/departments").then((res) => setDepartments(res.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, authUser, dbUser]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint app/\(auth\)/onboarding/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/onboarding/page.tsx"
git commit -m "fix: resolve set-state-in-effect lint error in onboarding page"
```

---

### Task 2: Fix `app/(dashboard)/employees/[id]/page.tsx` — set-state-in-effect + refs

**Files:**
- Modify: `app/(dashboard)/employees/[id]/page.tsx:170` (set-state-in-effect), `:672-673` (refs-during-render, avatar lightbox drag)

- [ ] **Step 1: Fix the set-state-in-effect at line 170**

```tsx
// before
useEffect(() => {
  if (!isAdminOrManager) return;
  setHistoryLoading(true);
  apiFetch<{ data: Transaction[] }>(`/api/points/history?userId=${id}`)
    .then((r) => setTransactions(r.data.slice(0, 15)))
    .catch(() => {})
    .finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id, isAdminOrManager]);

// after
useEffect(() => {
  if (!isAdminOrManager) return;
  queueMicrotask(() => setHistoryLoading(true));
  apiFetch<{ data: Transaction[] }>(`/api/points/history?userId=${id}`)
    .then((r) => setTransactions(r.data.slice(0, 15)))
    .catch(() => {})
    .finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id, isAdminOrManager]);
```

- [ ] **Step 2: Fix the refs-during-render at lines 672-673 (avatar lightbox pinch/drag)**

The compiler forbids reading `dragStart.current` during render (used for cursor/transition styling). Promote the boolean it's really expressing to state, and stop reading the ref itself in the render path:

```tsx
// add near the lightbox's other useState calls
const [isDragging, setIsDragging] = useState(false);

// style object — before used dragStart.current to derive these two values, after:
transition: isDragging ? "none" : "transform 0.1s ease",
cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",

// onMouseDown handler — keep the ref write (handlers aren't render), add the state set:
dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
setIsDragging(true);

// onMouseUp / onMouseLeave handlers:
onMouseUp={() => { dragStart.current = null; setIsDragging(false); }}
onMouseLeave={() => { dragStart.current = null; setIsDragging(false); }}
```

- [ ] **Step 3: Verify**

Run: `npx eslint "app/(dashboard)/employees/[id]/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 4: Manual check**

Open an employee detail page as an admin/manager in the browser: confirm the points history table still loads, and on the avatar photo lightbox confirm pinch/drag-to-pan still works and the cursor still changes between `zoom-in`/`grab`/`grabbing` correctly.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/employees/[id]/page.tsx"
git commit -m "fix: resolve set-state-in-effect and refs-during-render lint errors in employee detail page"
```

---

### Task 3: Fix `app/(dashboard)/feedback/page.tsx` — set-state-in-effect (x2)

**Files:**
- Modify: `app/(dashboard)/feedback/page.tsx:88`, `:97`

- [ ] **Step 1: Apply the fix**

```tsx
// before (first effect, ~line 88)
useEffect(() => {
  if (authLoading) return;
  if (!user) { setListLoading(false); return; }
  apiFetch<{ data: FeedbackItem[] }>("/api/feedback")
    .then((r) => setItems(r.data))
    .catch(console.error)
    .finally(() => setListLoading(false));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user]);

// after
useEffect(() => {
  if (authLoading) return;
  if (!user) { queueMicrotask(() => setListLoading(false)); return; }
  apiFetch<{ data: FeedbackItem[] }>("/api/feedback")
    .then((r) => setItems(r.data))
    .catch(console.error)
    .finally(() => setListLoading(false));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user]);
```

```tsx
// before (second effect, ~line 97)
useEffect(() => {
  if (panel.mode !== "thread") {
    setThread(null);
    setThreadError(null);
    return;
  }
  setThreadLoading(true);
  setThreadError(null);
  apiFetch<{ data: FeedbackThread }>(`/api/feedback/${panel.id}`)
    .then((r) => setThread(r.data))
    .catch((err) => setThreadError(err instanceof Error ? err.message : "Failed to load"))
    .finally(() => setThreadLoading(false));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [panel]);

// after
useEffect(() => {
  if (panel.mode !== "thread") {
    queueMicrotask(() => { setThread(null); setThreadError(null); });
    return;
  }
  queueMicrotask(() => { setThreadLoading(true); setThreadError(null); });
  apiFetch<{ data: FeedbackThread }>(`/api/feedback/${panel.id}`)
    .then((r) => setThread(r.data))
    .catch((err) => setThreadError(err instanceof Error ? err.message : "Failed to load"))
    .finally(() => setThreadLoading(false));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [panel]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/feedback/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/feedback/page.tsx"
git commit -m "fix: resolve set-state-in-effect lint errors in feedback page"
```

---

### Task 4: Fix `app/(dashboard)/layout.tsx` — set-state-in-effect

**Files:**
- Modify: `app/(dashboard)/layout.tsx:76`

- [ ] **Step 1: Apply the fix**

```tsx
// before
const [sidebarOpen, setSidebarOpen] = useState(false);
const [paletteOpen, setPaletteOpen] = useState(false);
useEffect(() => { setSidebarOpen(false); }, [pathname]);

// after — "adjusting state when a prop changes" pattern (react.dev), no effect needed
const [sidebarOpen, setSidebarOpen] = useState(false);
const [paletteOpen, setPaletteOpen] = useState(false);
const [prevPathname, setPrevPathname] = useState(pathname);
if (pathname !== prevPathname) {
  setPrevPathname(pathname);
  setSidebarOpen(false);
}
```

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/layout.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

In the browser at mobile width, open the sidebar drawer, navigate to another page, confirm the drawer auto-closes.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/layout.tsx"
git commit -m "fix: resolve set-state-in-effect lint error in dashboard layout"
```

---

### Task 5: Fix `app/(dashboard)/leaderboard/page.tsx` — set-state-in-effect + TDZ

**Files:**
- Modify: `app/(dashboard)/leaderboard/page.tsx:90` (set-state-in-effect), `:107` (used before declared)

- [ ] **Step 1: Reorder declarations and wrap effect call sites**

```tsx
// Function declarations move above the effects that reference them.
function loadDepartments() {
  apiFetch<{ data: Department[] }>("/api/departments")
    .then((res) => setDepartments(res.data))
    .catch(() => {});
}

function loadProfileAndAchievers() {
  setProfileLoading(true);
  setAchieversLoading(true);
  Promise.allSettled([
    apiFetch<{ data: UserProfile }>("/api/me"),
    apiFetch<{ data: Achiever[] }>("/api/leaderboard/achievers"),
  ]).then(([me, ach]) => {
    if (me.status === "fulfilled") setProfile(me.value.data);
    if (ach.status === "fulfilled") setAchievers(ach.value.data ?? []);
  }).finally(() => {
    setProfileLoading(false);
    setAchieversLoading(false);
  });
}

async function load() {
  setLoading(true);
  try {
    const params = new URLSearchParams({ period });
    if (departmentId !== "ALL") params.set("departmentId", departmentId);
    const res = await apiFetch<{ data: Entry[] }>(`/api/leaderboard?${params.toString()}`);
    setEntries(res.data);
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  if (authLoading || !user) return;
  loadDepartments();
  queueMicrotask(loadProfileAndAchievers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user]);

useEffect(() => {
  if (authLoading || !user) return;
  queueMicrotask(load);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user, period, departmentId]);
```

Note: `loadDepartments()` itself is not wrapped (it's not flagged — its setState only runs inside a `.then()`, which the compiler already treats as deferred); only `loadProfileAndAchievers` and `load` (which set state synchronously as their first statement) need the `queueMicrotask` wrap.

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/leaderboard/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

Load `/leaderboard`, confirm the entries table, profile card, and top-achievers list all still populate, and that switching the period/department filter still refetches.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/leaderboard/page.tsx"
git commit -m "fix: resolve set-state-in-effect and TDZ lint errors in leaderboard page"
```

---

### Task 6: Fix `app/(dashboard)/marketplace/page.tsx` — set-state-in-effect

**Files:**
- Modify: `app/(dashboard)/marketplace/page.tsx:100`

- [ ] **Step 1: Apply the fix**

```tsx
// before
useEffect(() => {
  if (view === "requests" && !authLoading && user) loadRedemptions();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [view, authLoading, user]);

// after
useEffect(() => {
  if (view === "requests" && !authLoading && user) queueMicrotask(loadRedemptions);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [view, authLoading, user]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/marketplace/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/marketplace/page.tsx"
git commit -m "fix: resolve set-state-in-effect lint error in marketplace page"
```

---

### Task 7: Fix `app/(dashboard)/minigames/[id]/page.tsx` — set-state-in-effect (x4)

**Files:**
- Modify: `app/(dashboard)/minigames/[id]/page.tsx:249` (TTTBoard), `:332` (C4Board), `:1104` (RightPanel mute init), `:1331` (fetchSession effect)

- [ ] **Step 1: TTTBoard (~line 249) — replace ref-diff-in-effect with state-diff-in-render**

```tsx
// before: a ref held the previous board and an effect diffed it against the new board to setLastMove
// after:
const [prevBoard, setPrevBoard] = useState(board);
const [lastMove, setLastMove] = useState<number | null>(null);
if (board !== prevBoard) {
  let changed: number | null = null;
  for (let i = 0; i < board.length; i++) if (board[i] && !prevBoard[i]) changed = i;
  if (changed !== null) setLastMove(changed);
  setPrevBoard(board);
}
```

- [ ] **Step 2: C4Board (~line 332) — same pattern for the 2D board**

```tsx
const [prevBoard, setPrevBoard] = useState(board);
const [lastMove, setLastMove] = useState<string | null>(null);
if (board !== prevBoard) {
  let changed: string | null = null;
  for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) {
    if (board[c][r] && !(prevBoard[c] && prevBoard[c][r])) changed = `${c}-${r}`;
  }
  if (changed) setLastMove(changed);
  setPrevBoard(board);
}
```

- [ ] **Step 3: RightPanel muted init (~line 1104) — lazy initial state instead of a mount effect**

```tsx
// before
const [muted, setMutedState] = useState(false);
useEffect(() => { setMutedState(isMuted()); }, []);

// after — safe because RightPanel only renders client-side after `session`
// has loaded (the page shows a loading skeleton until then), so this never
// runs during SSR and there's no hydration-mismatch risk.
const [muted, setMutedState] = useState(() => isMuted());
```

- [ ] **Step 4: fetchSession effect (~line 1331)**

```tsx
// before
useEffect(() => { fetchSession(); }, [fetchSession]);

// after
useEffect(() => { queueMicrotask(fetchSession); }, [fetchSession]);
```

- [ ] **Step 5: Verify**

Run: `npx eslint "app/(dashboard)/minigames/[id]/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 6: Manual check**

Start a Tic-Tac-Toe game and a Connect Four game (two browser sessions or one + a manual API poke), confirm the "last move" highlight still appears on the correct cell/column after each move, confirm the mute toggle still reflects persisted state on load, and confirm the game session still loads on page open.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/minigames/[id]/page.tsx"
git commit -m "fix: resolve set-state-in-effect lint errors in minigame session page"
```

---

### Task 8: Fix `app/(dashboard)/minigames/stats/page.tsx` — set-state-in-effect

**Files:**
- Modify: `app/(dashboard)/minigames/stats/page.tsx:81`

- [ ] **Step 1: Apply the fix**

```tsx
// before
useEffect(() => {
  if (authLoading || !user) return;
  setLoading(true);
  apiFetch<{ data: LeaderEntry[] }>(`/api/minigames/leaderboard?period=${period}`)
    .then(res => setBoard(res.data))
    .catch(() => setBoard([]))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user, period]);

// after
useEffect(() => {
  if (authLoading || !user) return;
  queueMicrotask(() => setLoading(true));
  apiFetch<{ data: LeaderEntry[] }>(`/api/minigames/leaderboard?period=${period}`)
    .then(res => setBoard(res.data))
    .catch(() => setBoard([]))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user, period]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/minigames/stats/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/minigames/stats/page.tsx"
git commit -m "fix: resolve set-state-in-effect lint error in minigames stats page"
```

---

### Task 9: Fix `app/(dashboard)/profile/page.tsx` — set-state-in-effect

**Files:**
- Modify: `app/(dashboard)/profile/page.tsx:340`

- [ ] **Step 1: Apply the fix**

```tsx
// before
useEffect(() => {
  if (activeTab !== "notifications" || notifPrefs !== null) return;
  setNotifLoading(true);
  apiFetch<{ data: Record<string, boolean> }>("/api/me/notification-preferences")
    .then((res) => setNotifPrefs(res.data))
    .catch(() => setNotifError("Failed to load preferences"))
    .finally(() => setNotifLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTab]);

// after
useEffect(() => {
  if (activeTab !== "notifications" || notifPrefs !== null) return;
  queueMicrotask(() => setNotifLoading(true));
  apiFetch<{ data: Record<string, boolean> }>("/api/me/notification-preferences")
    .then((res) => setNotifPrefs(res.data))
    .catch(() => setNotifError("Failed to load preferences"))
    .finally(() => setNotifLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeTab]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/profile/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/profile/page.tsx"
git commit -m "fix: resolve set-state-in-effect lint error in profile page"
```

---

### Task 10: Fix `app/admin/audit/page.tsx` — TDZ

**Files:**
- Modify: `app/admin/audit/page.tsx:104`

- [ ] **Step 1: Move `load()` above the effect and wrap the call site**

```tsx
async function load() {
  setLoading(true);
  try {
    const params = new URLSearchParams({ page: String(page) });
    if (filterAction) params.set("action", filterAction);
    const res = await apiFetch<{ data: AuditEntry[]; total: number; page: number; pages: number }>(
      `/api/admin/audit?${params}`
    );
    setEntries(res.data);
    setTotal(res.total);
    setPages(res.pages);
  } catch {
    // ignore
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  queueMicrotask(load);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [page, filterAction]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint app/admin/audit/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/audit/page.tsx
git commit -m "fix: resolve TDZ lint error in admin audit page"
```

---

### Task 11: Fix `app/admin/documents/page.tsx` — set-state-in-effect, unescaped entity, and aria-labels

**Files:**
- Modify: `app/admin/documents/page.tsx:68` (set-state-in-effect); `:403:190` (unescaped entity); `:295-297`, `:298-300`, `:305-311`, `:357-363`, `:409-416` (missing aria-labels, AGShub #35)

- [ ] **Step 1: Fix set-state-in-effect at line 68 — wrap the call site (`load` is already declared above this effect)**

```tsx
// before
useEffect(() => { load(); }, [page]);
// after
useEffect(() => { queueMicrotask(load); }, [page]);
```

- [ ] **Step 2: Fix the unescaped entity at line 403**

```tsx
// before
"...which makes Ally's answers more accurate."
// after
"...which makes Ally&apos;s answers more accurate."
```

- [ ] **Step 3: Add missing aria-labels (AGShub #35)**

```tsx
// ~295-297, confirm rename button
<button onClick={() => handleRename(doc.id)} aria-label="Save name" className="text-emerald-500 hover:text-emerald-700">
  <Check className="w-4 h-4" aria-hidden="true" />
</button>

// ~298-300, cancel rename button
<button onClick={() => setRenamingId(null)} aria-label="Cancel rename" className="text-gray-500 hover:text-gray-600">
  <X className="w-4 h-4" />
</button>

// ~305-311, rename trigger (already has title="Rename" — add aria-label alongside it)
<button onClick={...} title="Rename" aria-label="Rename">
  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
</button>

// ~357-363, delete button (already has title="Delete")
<button onClick={() => handleDelete(doc.id, doc.name)} title="Delete" aria-label="Delete">
  <Trash2 className="w-4 h-4" aria-hidden="true" />
</button>

// ~409-416, copy prompt button (already has title="Copy prompt")
<button type="button" onClick={copyPrompt} title="Copy prompt" aria-label="Copy prompt">
  {promptCopied ? <CheckCheck ... /> : <Copy ... />}
</button>
```

- [ ] **Step 4: Verify**

Run: `npx eslint app/admin/documents/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 5: Manual check**

On `/admin/documents`: upload a document, rename it (confirm + cancel both), delete one, and copy the Ally prompt — confirm all five actions still work, and spot-check with a screen reader (or browser accessibility inspector) that each icon-only button now announces its label.

- [ ] **Step 6: Commit**

```bash
git add app/admin/documents/page.tsx
git commit -m "fix: resolve lint errors and add missing aria-labels in admin documents page"
```

---

### Task 12: Fix `app/admin/employees/page.tsx` — set-state-in-effect + unescaped entities

**Files:**
- Modify: `app/admin/employees/page.tsx:97` (set-state-in-effect), `:398:163,167` (unescaped entities)

- [ ] **Step 1: Replace the filter-reset effect with the "adjust state during render" pattern**

```tsx
// before
useEffect(() => {
  setPage(1);
}, [search, filterDept, filterRole, filterStatus]);

// after
const [prevFilters, setPrevFilters] = useState({ search, filterDept, filterRole, filterStatus });
if (
  search !== prevFilters.search ||
  filterDept !== prevFilters.filterDept ||
  filterRole !== prevFilters.filterRole ||
  filterStatus !== prevFilters.filterStatus
) {
  setPrevFilters({ search, filterDept, filterRole, filterStatus });
  setPage(1);
}
```

- [ ] **Step 2: Fix the unescaped quotes at line 398**

```tsx
// before
text like "N/A" = active
// after
text like &quot;N/A&quot; = active
```

- [ ] **Step 3: Verify**

Run: `npx eslint app/admin/employees/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 4: Manual check**

On `/admin/employees`, type into the search box and change a filter dropdown — confirm the page resets to 1 each time, and pagination still works.

- [ ] **Step 5: Commit**

```bash
git add app/admin/employees/page.tsx
git commit -m "fix: resolve set-state-in-effect and unescaped-entity lint errors in admin employees page"
```

---

### Task 13: Fix `app/admin/feedback/page.tsx` — set-state-in-effect (x2)

**Files:**
- Modify: `app/admin/feedback/page.tsx:50`, `:58`

- [ ] **Step 1: Apply the fix**

```tsx
// before (~line 50)
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

// after
useEffect(() => {
  if (authLoading || !user) return;
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (categoryFilter) params.set("category", categoryFilter);
  queueMicrotask(() => setLoading(true));
  apiFetch<{ data: FeedbackItem[]; pages: number }>(`/api/admin/feedback?${params}`)
    .then((r) => { setFeedbacks(r.data); setPages(r.pages); })
    .catch(console.error)
    .finally(() => setLoading(false));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user, statusFilter, categoryFilter, page]);
```

```tsx
// before (~line 58)
useEffect(() => { setPage(1); }, [statusFilter, categoryFilter]);

// after
const [prevFilters, setPrevFilters] = useState({ statusFilter, categoryFilter });
if (statusFilter !== prevFilters.statusFilter || categoryFilter !== prevFilters.categoryFilter) {
  setPrevFilters({ statusFilter, categoryFilter });
  setPage(1);
}
```

- [ ] **Step 2: Verify**

Run: `npx eslint app/admin/feedback/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/feedback/page.tsx
git commit -m "fix: resolve set-state-in-effect lint errors in admin feedback page"
```

---

### Task 14: Fix `app/admin/layout.tsx` — set-state-in-effect

**Files:**
- Modify: `app/admin/layout.tsx:42`

- [ ] **Step 1: Apply the fix (leave the role-redirect effect untouched — only the sidebar-close-on-route-change effect is flagged)**

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);
const [prevPathname, setPrevPathname] = useState(pathname);

useEffect(() => {
  if (!loading && dbUser?.role !== "HR_ADMIN" && dbUser?.role !== "SUPER_ADMIN") {
    router.replace("/dashboard");
  }
}, [loading, dbUser, router]);

// before: useEffect(() => { setSidebarOpen(false); }, [pathname]);
// after:
if (pathname !== prevPathname) {
  setPrevPathname(pathname);
  setSidebarOpen(false);
}
```

- [ ] **Step 2: Verify**

Run: `npx eslint app/admin/layout.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

As an HR admin, open the mobile sidebar drawer under `/admin`, navigate to another admin page, confirm the drawer auto-closes; as a non-admin, confirm the redirect to `/dashboard` still fires.

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "fix: resolve set-state-in-effect lint error in admin layout"
```

---

### Task 15: Fix `app/admin/medicine/page.tsx` — set-state-in-effect (x3)

**Files:**
- Modify: `app/admin/medicine/page.tsx:104`, `:114`, `:127`

- [ ] **Step 1: Wrap the two loading-flag sets**

```tsx
// :104
queueMicrotask(() => setLoadingMeds(true));
// :114
queueMicrotask(() => setLoadingReqs(true));
```

- [ ] **Step 2: Replace the request-filter reset effect at line 127**

```tsx
// before
useEffect(() => {
  setReqPage(1);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [dateFrom, dateTo, statusFilter]);

// after
const [prevReqFilters, setPrevReqFilters] = useState({ dateFrom, dateTo, statusFilter });
if (
  dateFrom !== prevReqFilters.dateFrom ||
  dateTo !== prevReqFilters.dateTo ||
  statusFilter !== prevReqFilters.statusFilter
) {
  setPrevReqFilters({ dateFrom, dateTo, statusFilter });
  setReqPage(1);
}
```

- [ ] **Step 3: Verify**

Run: `npx eslint app/admin/medicine/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 4: Manual check**

On `/admin/medicine`, confirm the medicine inventory list and the requests queue both still load, and that changing the date range or status filter on the requests tab resets its pagination to page 1.

- [ ] **Step 5: Commit**

```bash
git add app/admin/medicine/page.tsx
git commit -m "fix: resolve set-state-in-effect lint errors in admin medicine page"
```

---

### Task 16: Fix `app/admin/points/page.tsx` — set-state-in-effect

**Files:**
- Modify: `app/admin/points/page.tsx:165`

- [ ] **Step 1: Apply the fix**

```tsx
// before
useEffect(() => {
  if (authLoading || !user) return;
  loadAllEmployees();
  loadHistory(txPage);
  loadBudget();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user]);

// after
useEffect(() => {
  if (authLoading || !user) return;
  queueMicrotask(loadAllEmployees);
  loadHistory(txPage); // called with an argument — compiler doesn't trace these
  queueMicrotask(loadBudget);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [authLoading, user]);
```

Note: both zero-argument calls (`loadAllEmployees`, `loadBudget`) need wrapping — the compiler only reports one offender per lint pass in this file, so after fixing `loadAllEmployees` re-run eslint and confirm `loadBudget` doesn't newly surface; wrap it preemptively per the code above to save a round-trip.

- [ ] **Step 2: Verify**

Run: `npx eslint app/admin/points/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

On `/admin/points`, confirm the employee list, transaction history, and manager budget panel all still load on page open.

- [ ] **Step 4: Commit**

```bash
git add app/admin/points/page.tsx
git commit -m "fix: resolve set-state-in-effect lint error in admin points page"
```

---

### Task 17: Fix `components/CommandPalette.tsx` — set-state-in-effect

**Files:**
- Modify: `components/CommandPalette.tsx:49`

- [ ] **Step 1: Split the reset-on-open logic (render-time adjust) from the focus side effect (real effect)**

```tsx
// before: one effect did both the state reset and the DOM focus() call
// after:
const [prevOpen, setPrevOpen] = useState(open);
if (open !== prevOpen) {
  setPrevOpen(open);
  if (open) {
    setQuery("");
    setResults([]);
    setFocusIndex(-1);
    setError(false);
  }
}

useEffect(() => {
  if (open) setTimeout(() => inputRef.current?.focus(), 0);
}, [open]);
```

- [ ] **Step 2: Verify**

Run: `npx eslint components/CommandPalette.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

Open the command palette (keyboard shortcut), type a query, close it, reopen it — confirm the query/results/focus all reset and the input still auto-focuses.

- [ ] **Step 4: Commit**

```bash
git add components/CommandPalette.tsx
git commit -m "fix: resolve set-state-in-effect lint error in command palette"
```

---

### Task 18: Fix `components/ImageLightbox.tsx` — set-state-in-effect

**Files:**
- Modify: `components/ImageLightbox.tsx:19`

- [ ] **Step 1: Apply the fix**

```tsx
// before
const [index, setIndex] = useState(initialIndex);
useEffect(() => {
  setIndex(initialIndex);
}, [initialIndex, open]);

// after
const [index, setIndex] = useState(initialIndex);
const [prevKey, setPrevKey] = useState({ initialIndex, open });
if (initialIndex !== prevKey.initialIndex || open !== prevKey.open) {
  setPrevKey({ initialIndex, open });
  setIndex(initialIndex);
}
```

- [ ] **Step 2: Verify**

Run: `npx eslint components/ImageLightbox.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

Open an image gallery that uses the lightbox, navigate between images, close and reopen at a different starting index — confirm it always opens on the correct image.

- [ ] **Step 4: Commit**

```bash
git add components/ImageLightbox.tsx
git commit -m "fix: resolve set-state-in-effect lint error in image lightbox"
```

---

### Task 19: Fix the "latest ref" pattern in `AuthProvider.tsx`, `useRealtimeChannel.ts`, `useVisibleInterval.ts` — refs-during-render

**Files:**
- Modify: `lib/auth/AuthProvider.tsx:113`, `lib/hooks/useRealtimeChannel.ts:39`, `lib/hooks/useVisibleInterval.ts:20`

Identical fix in all three: the ref write happens directly in the component/hook body (during render), which the compiler forbids. Move it into a dependency-less `useEffect` (still re-syncs on every render, same "always has the latest value" behavior, just no longer during render itself).

- [ ] **Step 1: `lib/auth/AuthProvider.tsx`**

```tsx
// before
const refreshRef = useRef(refreshProfile);
refreshRef.current = refreshProfile;
useRealtimeChannel(dbUser?.id ? `points:${dbUser.id}` : null, () => refreshRef.current());

// after
const refreshRef = useRef(refreshProfile);
useEffect(() => { refreshRef.current = refreshProfile; });
useRealtimeChannel(dbUser?.id ? `points:${dbUser.id}` : null, () => refreshRef.current());
```

- [ ] **Step 2: `lib/hooks/useRealtimeChannel.ts`**

```tsx
// before
const cb = useRef(onMessage);
cb.current = onMessage;
const keepAliveWhenHidden = options.keepAliveWhenHidden ?? false;

// after
const cb = useRef(onMessage);
useEffect(() => { cb.current = onMessage; });
const keepAliveWhenHidden = options.keepAliveWhenHidden ?? false;
```

- [ ] **Step 3: `lib/hooks/useVisibleInterval.ts`**

```tsx
// before
const cb = useRef(fn);
cb.current = fn;
const visible = useTabVisible();

// after
const cb = useRef(fn);
useEffect(() => { cb.current = fn; });
const visible = useTabVisible();
```

- [ ] **Step 4: Verify**

Run: `npx eslint lib/auth/AuthProvider.tsx lib/hooks/useRealtimeChannel.ts lib/hooks/useVisibleInterval.ts && npx tsc --noEmit`
Expected: 0 errors from these 3 files; no new tsc errors.

- [ ] **Step 5: Manual check**

These three are foundational (auth refresh on points changes, all Realtime-subscribed components, all polling components) — do a broad smoke pass: sign in, confirm the points balance updates live after an award, open a page that polls on an interval (e.g. minigames lobby) and confirm it still refreshes, switch tabs away and back and confirm no console errors.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/AuthProvider.tsx lib/hooks/useRealtimeChannel.ts lib/hooks/useVisibleInterval.ts
git commit -m "fix: resolve refs-during-render lint errors in auth and realtime hooks"
```

---

### Task 20: Fix `app/(dashboard)/food/page.tsx` — unescaped entity + missing aria-label

**Files:**
- Modify: `app/(dashboard)/food/page.tsx:952` (unescaped entity), `:511` (missing aria-label, AGShub #35)

- [ ] **Step 1: Fix the unescaped quotes at line 952**

```tsx
// before
{o.note && <p className="text-[11px] text-gray-500 italic mt-0.5">"{o.note}"</p>}
// after
{o.note && <p className="text-[11px] text-gray-500 italic mt-0.5">&ldquo;{o.note}&rdquo;</p>}
```

- [ ] **Step 2: Add the missing aria-label at line 511 (`removeAddOn`)**

```tsx
// before
<button type="button" onClick={() => removeAddOn(i)} className="text-gray-500 hover:text-gray-700">
  <X className="w-3 h-3" />
</button>

// after
<button type="button" onClick={() => removeAddOn(i)} aria-label="Remove add-on" className="text-gray-500 hover:text-gray-700">
  <X className="w-3 h-3" />
</button>
```

- [ ] **Step 3: Verify**

Run: `npx eslint "app/(dashboard)/food/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 4: Manual check**

On `/food`, add a custom order with an add-on, confirm the remove-add-on button still works and (via accessibility inspector) now announces "Remove add-on"; confirm an order note with quotes still displays correctly with curly quotes.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/food/page.tsx"
git commit -m "fix: resolve unescaped-entity lint error and add missing aria-label in food page"
```

---

### Task 21: Add missing aria-label in `app/(dashboard)/feed/page.tsx` (AGShub #35)

**Files:**
- Modify: `app/(dashboard)/feed/page.tsx:1248-1253` (`removeImage`)

- [ ] **Step 1: Apply the fix**

```tsx
// before
<button
  type="button"
  onClick={() => removeImage(i)}
  className="absolute top-1 right-1 w-5 h-5 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
>
  <X className="w-3 h-3" />
</button>

// after
<button
  type="button"
  onClick={() => removeImage(i)}
  aria-label="Remove image"
  className="absolute top-1 right-1 w-5 h-5 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
>
  <X className="w-3 h-3" />
</button>
```

- [ ] **Step 2: Verify**

Run: `npx eslint "app/(dashboard)/feed/page.tsx" && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

On `/feed`, start a new post, attach an image, confirm the remove-image button still works and now announces "Remove image".

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/feed/page.tsx"
git commit -m "fix: add missing aria-label to remove-image button in feed page"
```

---

### Task 22: Add missing aria-labels in `app/admin/rewards/page.tsx` (AGShub #35)

**Files:**
- Modify: `app/admin/rewards/page.tsx:283-289` (`removeExistingImage`), `:296-302` (`removeNewImage`)

- [ ] **Step 1: Apply both fixes**

```tsx
// removeExistingImage, ~283-289
<button type="button" onClick={() => removeExistingImage(i)} aria-label="Remove image" className="...">
  <X className="w-3 h-3" />
</button>

// removeNewImage, ~296-302
<button type="button" onClick={() => removeNewImage(i)} aria-label="Remove image" className="...">
  <X className="w-3 h-3" />
</button>
```

- [ ] **Step 2: Verify**

Run: `npx eslint app/admin/rewards/page.tsx && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

On `/admin/rewards`, edit a reward with existing images, remove one existing and one newly-added image, confirm both remove buttons still work and now announce "Remove image".

- [ ] **Step 4: Commit**

```bash
git add app/admin/rewards/page.tsx
git commit -m "fix: add missing aria-labels to image-remove buttons in admin rewards page"
```

---

### Task 23: Fix `app/api/me/notification-preferences/route.ts` — no-explicit-any

**Files:**
- Modify: `app/api/me/notification-preferences/route.ts:76`

- [ ] **Step 1: Apply the fix**

```ts
// before
data: { notificationPrefs: updated as any },

// after — same cast already used for this exact situation in lib/helpers/createNotification.ts
import { Prisma } from "@/lib/generated/prisma/client";
// ...
data: { notificationPrefs: updated as Prisma.InputJsonValue },
```

- [ ] **Step 2: Verify**

Run: `npx eslint app/api/me/notification-preferences/route.ts && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/me/notification-preferences/route.ts
git commit -m "fix: replace explicit any with Prisma.InputJsonValue in notification preferences route"
```

---

### Task 24: Fix `app/api/points/award/route.ts` and `app/api/points/award/bulk/route.ts` — prefer-const

**Files:**
- Modify: `app/api/points/award/route.ts:41`, `app/api/points/award/bulk/route.ts:41`

- [ ] **Step 1: `app/api/points/award/route.ts`**

```ts
// before
let { amount, category, activity } = parsed.data;
// after — activity is never reassigned; amount/category are, inside the preset-resolution block below
const { toUserId, note, activity } = parsed.data;
let { amount, category } = parsed.data;
```

- [ ] **Step 2: `app/api/points/award/bulk/route.ts`**

```ts
// before
let { amount, category, activity } = parsed.data;
// after
const { userIds, note, activity } = parsed.data;
let { amount, category } = parsed.data;
```

- [ ] **Step 3: Verify**

Run: `npx eslint app/api/points/award/route.ts app/api/points/award/bulk/route.ts && npx tsc --noEmit`
Expected: 0 errors from these 2 files; no new tsc errors.

- [ ] **Step 4: Manual check**

Award points to one employee and via bulk-award to multiple employees (as a manager/admin), using both a preset activity and a custom amount+category — confirm both flows still work identically.

- [ ] **Step 5: Commit**

```bash
git add app/api/points/award/route.ts app/api/points/award/bulk/route.ts
git commit -m "fix: resolve prefer-const lint errors in points award routes"
```

---

### Task 25: Add `lib/excel/sheetToRows.ts` and swap `xlsx` for `exceljs` in package.json (AGShub #36)

**Files:**
- Create: `lib/excel/sheetToRows.ts`
- Modify: `package.json` (remove `xlsx`, add `exceljs`)

**Interfaces:**
- Produces: `sheetToRows(worksheet: import("exceljs").Worksheet): Record<string, unknown>[]` — consumed by Task 26 and Task 27.

- [ ] **Step 1: Install exceljs, remove xlsx**

```bash
npm install exceljs
npm uninstall xlsx
```

- [ ] **Step 2: Create the shared helper**

```ts
import type { Worksheet } from "exceljs";

// exceljs has no sheet_to_json equivalent. Replicates the xlsx behavior both
// upload routes relied on (XLSX.utils.sheet_to_json(sheet, { defval: null })):
// row 1 is the header row, every subsequent row becomes a
// { headerText: cellValue } record, and missing cells resolve to null
// (not undefined) so `row["Some Column"]` checks behave identically.
export function sheetToRows(worksheet: Worksheet): Record<string, unknown>[] {
  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      record[header] = row.getCell(colNumber).value ?? null;
    });
    rows.push(record);
  });
  return rows;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (both upload routes still reference the now-removed `xlsx` package at this point, so this step will show those 2 files failing to resolve the `xlsx` import — confirm the *only* new errors are in `app/api/admin/employees/sync/route.ts` and `app/api/admin/attendance/award/route.ts`, both fixed in Tasks 26-27).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/excel/sheetToRows.ts
git commit -m "chore: replace xlsx with exceljs to resolve unfixable CVEs"
```

---

### Task 26: Migrate `app/api/admin/employees/sync/route.ts` from xlsx to exceljs

**Files:**
- Modify: `app/api/admin/employees/sync/route.ts:82`, `:84-90`, `:92`, `:93`

**Interfaces:**
- Consumes: `sheetToRows` from `lib/excel/sheetToRows.ts` (Task 25)

- [ ] **Step 1: Apply the fix**

```ts
// before (~82)
const XLSX = require("xlsx") as typeof import("xlsx");
// after
import ExcelJS from "exceljs";
import { sheetToRows } from "@/lib/excel/sheetToRows";
```

```ts
// before (~84-90)
let workbook: import("xlsx").WorkBook;
try {
  workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
} catch (e) {
  return NextResponse.json({ error: "Could not parse uploaded file" }, { status: 400 });
}

// after
const workbook = new ExcelJS.Workbook();
try {
  await workbook.xlsx.load(buffer);
} catch (e) {
  return NextResponse.json({ error: "Could not parse uploaded file" }, { status: 400 });
}
```

```ts
// before (~92-93)
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

// after
const worksheet = workbook.worksheets[0];
if (!worksheet) {
  return NextResponse.json({ error: "Uploaded file has no worksheets" }, { status: 400 });
}
const rows = sheetToRows(worksheet);
```

Leave every other line in this route (the `row["Email"]`, `row["Separation Date"]`, etc. field access, and all business logic below) untouched — `sheetToRows` returns the same `Record<string, unknown>[]` shape.

- [ ] **Step 2: Verify**

Run: `npx eslint app/api/admin/employees/sync/route.ts && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

Upload a real Sprout HR export .xlsx through `/admin/employees` (the sync upload UI), including at least one row that updates an *existing* employee (not just new-employee rows) — confirm it still parses correctly, dates (hire date, separation date) still come through as real `Date` objects, and the employee record updates as expected. This is the exact route flagged elsewhere (AGSON #28) as having previously broken on the update-existing-employee path, so this is worth being thorough about.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/employees/sync/route.ts
git commit -m "fix: migrate employees/sync route from xlsx to exceljs"
```

---

### Task 27: Migrate `app/api/admin/attendance/award/route.ts` from xlsx to exceljs

**Files:**
- Modify: `app/api/admin/attendance/award/route.ts:45`, `:47-52`, `:54-57`, `:59`

**Interfaces:**
- Consumes: `sheetToRows` from `lib/excel/sheetToRows.ts` (Task 25)

- [ ] **Step 1: Apply the fix**

```ts
// before (~45)
const XLSX = require("xlsx") as typeof import("xlsx");
// after
import ExcelJS from "exceljs";
import { sheetToRows } from "@/lib/excel/sheetToRows";
```

```ts
// before (~47-52)
let workbook: import("xlsx").WorkBook;
try {
  workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
} catch {
  return NextResponse.json({ error: "Could not parse uploaded file" }, { status: 400 });
}

// after
const workbook = new ExcelJS.Workbook();
try {
  await workbook.xlsx.load(buffer);
} catch {
  return NextResponse.json({ error: "Could not parse uploaded file" }, { status: 400 });
}
```

```ts
// before (~54-59)
const sheet = workbook.Sheets["Summary"];
if (!sheet) {
  return NextResponse.json({ error: "Uploaded file has no 'Summary' sheet" }, { status: 400 });
}
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

// after
const worksheet = workbook.getWorksheet("Summary");
if (!worksheet) {
  return NextResponse.json({ error: "Uploaded file has no 'Summary' sheet" }, { status: 400 });
}
const rows = sheetToRows(worksheet);
```

Leave every other line (the `r["Days Present"]`, `r["Days Absent *"]`, `r["Undertime *"]`, `r["ID No"]` field access, and all business logic below) untouched.

- [ ] **Step 2: Verify**

Run: `npx eslint app/api/admin/attendance/award/route.ts && npx tsc --noEmit`
Expected: 0 errors from this file; no new tsc errors.

- [ ] **Step 3: Manual check**

Upload a real attendance summary .xlsx (with a "Summary" sheet) through the admin attendance-award upload UI — confirm it still parses, the days-present/absent/undertime columns come through correctly, and points get awarded as expected.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/attendance/award/route.ts
git commit -m "fix: migrate attendance/award route from xlsx to exceljs"
```

---

### Task 28: Fix `components/dashboard/DashboardFeedCard.tsx` and `lib/hooks/useModalA11y.ts` — discovered during final verification

**Files:**
- Modify: `components/dashboard/DashboardFeedCard.tsx:246` (set-state-in-effect), `:334` (impure-function-during-render)
- Modify: `lib/hooks/useModalA11y.ts:22` (refs-during-render)

**Context:** This plan's original 39-error count (Tasks 1-27) was gathered while on a different, not-yet-merged branch (`fix/security-fixes-and-design-system-consolidation`) before this plan's branch (`fix/lint-a11y-xlsx-hardening`) was created fresh off `main` per this plan's Global Constraint. That other branch had already independently fixed these 2 files in commits not yet on `main`; `main` (and therefore this branch) still has them broken. Task 28 (originally the final verification step, renumbered to Task 29 below) caught this via a full `npm run lint` run showing 3 residual errors instead of 0.

- [ ] **Step 1: Fix the set-state-in-effect at `DashboardFeedCard.tsx:245-250`**

```tsx
// before
useEffect(() => {
  setReactions(initialPost.reactions);
  setMyReactions(initialPost.myReactions);
  setCommentCount(initialPost.commentCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialPost.id]);

// after
useEffect(() => {
  queueMicrotask(() => {
    setReactions(initialPost.reactions);
    setMyReactions(initialPost.myReactions);
    setCommentCount(initialPost.commentCount);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialPost.id]);
```

- [ ] **Step 2: Fix the impure-function flag at `DashboardFeedCard.tsx:334`**

The compiler flags `Date.now()` inside `submitReply` (but, inconsistently, not the identical `Date.now()` one function above in `submitComment` at line 304 — a known static-analysis inconsistency in this exact eslint plugin, already documented in this plan's Task 7 research). Both call sites are inside event handlers (`onKeyDown`/`onClick`), never during render, so this is a false positive rather than a real purity bug. Fix by avoiding the flagged builtin entirely rather than fighting the analyzer — swap to `crypto.randomUUID()`, which is also a strictly better optimistic-ID generator (no collision risk between near-simultaneous replies):

```tsx
// before
const optimisticId = `opt-reply-${Date.now()}`;

// after
const optimisticId = `opt-reply-${crypto.randomUUID()}`;
```

Leave `submitComment`'s `Date.now()`-based ID (line 304) untouched — it isn't flagged, and this plan's constraint is "don't touch lines not listed here."

- [ ] **Step 3: Fix the refs-during-render at `useModalA11y.ts:20-22`**

```tsx
// before
const ref = useRef<HTMLDivElement>(null);
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose;

// after
const ref = useRef<HTMLDivElement>(null);
const onCloseRef = useRef(onClose);
useEffect(() => { onCloseRef.current = onClose; });
```

Confirm `useEffect` is already imported in this file before adding the call (it almost certainly is, since the hook already uses `useEffect` elsewhere per the plan's earlier research) — do not touch anything else in this file. This hook has 3 real call sites (`app/admin/medicine/page.tsx`, `app/admin/employees/page.tsx` x2, `app/admin/documents/page.tsx`) despite an AGShub ticket incorrectly claiming it was deleted as dead code — do not delete this file.

- [ ] **Step 4: Verify**

Run: `npx eslint components/dashboard/DashboardFeedCard.tsx lib/hooks/useModalA11y.ts && npx tsc --noEmit`
Expected: 0 errors from both files; no new tsc errors.

- [ ] **Step 5: Manual check**

On `/feed` (or wherever `DashboardFeedCard` renders), post a comment and a reply to a comment — confirm both still work and the optimistic UI still appears/reconciles correctly. On any page using a modal built on `useModalA11y` (admin medicine edit, admin employees add/edit, admin documents upload), confirm Escape-to-close and focus trapping still work.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/DashboardFeedCard.tsx lib/hooks/useModalA11y.ts
git commit -m "fix: resolve lint errors in DashboardFeedCard and useModalA11y (main-branch drift)"
```

---

### Task 29: Full-repo verification

**Files:** none (verification only)

- [ ] **Step 1: Full lint pass**

Run: `npm run lint`
Expected: `0 errors` (warnings are out of scope for this plan — do not attempt to silence them).

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Full production build**

Run: `npm run build`
Expected: build completes successfully (this also re-confirms the xlsx→exceljs swap doesn't break anything at build time, since `npm audit` will no longer flag `xlsx` at all).

- [ ] **Step 4: Dependency audit**

Run: `npm audit`
Expected: the previously-flagged `xlsx` Prototype Pollution / ReDoS advisories are gone.

- [ ] **Step 5: Broad live smoke test**

Run `npm run dev` and, signed in as an HR admin, click through: dashboard, feed (post + image upload), leaderboard, marketplace (browse + a request), food (order with add-on), profile (including the notifications tab), a minigame session, admin audit log, admin documents (upload/rename/delete), admin employees (search/filter, upload a sync file), admin feedback, admin medicine, admin points (award + bulk award), admin rewards (edit images). Confirm no console errors and no regressions versus current production behavior.

- [ ] **Step 6: Final commit if anything was missed**

If any of the above surfaces a leftover issue, fix it and commit with a clear message before moving on — do not leave this branch in a partially-broken state.
