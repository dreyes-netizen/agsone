# Minigames UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the in-game experience with a full-screen result overlay, animated turn indicator, styled forfeit modal, and better mobile board sizing.

**Architecture:** All changes are purely frontend. A new `GameResultOverlay` component handles the win/loss/draw screen. A `WaitingDots` helper drives the animated turn indicator in the sidebar and mobile bar. The forfeit `confirm()` is replaced with an inline `ForfeitModal`. Board max-widths are updated to fill mobile viewports.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, Supabase Realtime (unchanged)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `components/minigames/GameResultOverlay.tsx` | **Create** | Full-screen result overlay component |
| `app/(dashboard)/minigames/[id]/page.tsx` | **Modify** | Wire overlay, add `WaitingDots`, update `RightPanel` + `MobileBar` turn indicator, add `ForfeitModal`, fix board sizing, lift `h2h` fetch to page level |

---

## Task 1: Create `GameResultOverlay` component

**Files:**
- Create: `components/minigames/GameResultOverlay.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";

type Player = { id: string; displayName: string; avatarUrl: string | null };

type Session = {
  id: string;
  gameType: string;
  status: string;
  state: Record<string, unknown>;
  winnerId: string | null;
  pointsWager: number;
  host: Player;
  guest: Player | null;
  myRole: "host" | "guest" | "spectator";
};

const GAME_LABELS: Record<string, string> = {
  TIC_TAC_TOE: "Tic-Tac-Toe",
  CONNECT_FOUR: "Connect Four",
  RPS: "Rock Paper Scissors",
  DOTS_AND_BOXES: "Dots & Boxes",
  BATTLESHIP: "Battleship",
  MEMORY: "Memory",
};

type Props = {
  session: Session;
  myId: string | undefined;
  h2h: { wins: number; losses: number; draws: number } | null;
  onNavigate: (path: string) => void;
};

export function GameResultOverlay({ session, myId, h2h, onNavigate }: Props) {
  const { apiFetch } = useApiClient();
  const [visible, setVisible] = useState(false);
  const [rematching, setRematching] = useState(false);

  // Fade in after a short delay so confetti fires first
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  const won = !!myId && session.winnerId === myId;
  const draw = !session.winnerId;
  const opponent = session.myRole === "host" ? session.guest : session.host;

  const rematchId = (session.state as { rematchSessionId?: string }).rematchSessionId;
  const rematchHostId = (session.state as { rematchHostId?: string }).rematchHostId;
  const iStartedRematch = !!rematchHostId && rematchHostId === myId;

  const emoji = draw ? "🤝" : won ? "🏆" : "💪";
  const title = draw ? "It's a Draw!" : won ? "Victory!" : "Good Game";

  const pointsLabel = session.pointsWager > 0
    ? (draw ? "±0 pts" : won ? `+${session.pointsWager} pts` : `−${session.pointsWager} pts`)
    : null;
  const pointsColor = draw ? "text-amber-300" : won ? "text-indigo-300" : "text-rose-300";

  const bgGradient = draw
    ? "from-[#451a03] to-[#78350f]"
    : won
    ? "from-[#1e1b4b] to-[#312e81]"
    : "from-[#1c1917] to-[#292524]";

  let h2hLine: string | null = null;
  if (h2h && opponent && h2h.wins + h2h.losses + h2h.draws > 0) {
    const record = `${h2h.wins}–${h2h.losses}${h2h.draws > 0 ? `–${h2h.draws}` : ""}`;
    const verdict =
      h2h.wins > h2h.losses ? "you lead" :
      h2h.wins < h2h.losses ? "you trail" : "all square";
    h2hLine = `vs ${opponent.displayName} · ${record} · ${verdict}`;
  }

  async function startRematch() {
    setRematching(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>(
        `/api/minigames/sessions/${session.id}/rematch`,
        { method: "POST" }
      );
      onNavigate(`/minigames/${res.data.id}`);
    } catch {
      setRematching(false);
    }
  }

  async function acceptRematch() {
    if (!rematchId) return;
    setRematching(true);
    try {
      await apiFetch(`/api/minigames/sessions/${rematchId}/join`, { method: "POST" });
      onNavigate(`/minigames/${rematchId}`);
    } catch {
      setRematching(false);
      alert("Couldn't join the rematch — it may have been cancelled or you're short on points.");
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br ${bgGradient} transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex flex-col items-center text-center px-8 max-w-xs w-full">
        <div className="text-7xl mb-4">{emoji}</div>
        <h2 className="text-3xl font-black text-white mb-1">{title}</h2>
        <p className="text-sm text-white/60 mb-2">
          {GAME_LABELS[session.gameType] ?? session.gameType}
        </p>
        {pointsLabel && (
          <p className={`text-xl font-bold mb-2 ${pointsColor}`}>{pointsLabel}</p>
        )}
        {h2hLine ? (
          <p className="text-xs text-white/50 bg-white/10 rounded-full px-4 py-1.5 mb-6">
            {h2hLine}
          </p>
        ) : (
          <div className="mb-6" />
        )}

        <div className="flex gap-3 w-full">
          {opponent && (
            rematchId ? (
              iStartedRematch ? (
                <button
                  onClick={() => onNavigate(`/minigames/${rematchId}`)}
                  className="flex-1 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Go to rematch →
                </button>
              ) : (
                <button
                  onClick={acceptRematch}
                  disabled={rematching}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  {rematching ? "Joining…" : "✅ Accept rematch →"}
                </button>
              )
            ) : (
              <button
                onClick={startRematch}
                disabled={rematching}
                className="flex-1 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {rematching ? "Sending…" : "🔁 Rematch"}
              </button>
            )
          )}
          <button
            onClick={() => onNavigate("/minigames")}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white/80 font-medium rounded-xl transition-colors text-sm"
          >
            Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file was created with no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors referencing `GameResultOverlay.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/minigames/GameResultOverlay.tsx
git commit -m "feat(minigames): add GameResultOverlay full-screen result component"
```

---

## Task 2: Wire `GameResultOverlay` into the page + lift `h2h` fetch

**Files:**
- Modify: `app/(dashboard)/minigames/[id]/page.tsx`

The `h2h` data (head-to-head record) is currently fetched inside `RightPanel`. We lift it to `MinigameSessionPage` so it can be passed to the new overlay.

- [ ] **Step 1: Add `h2h` state and import to `MinigameSessionPage`**

In `app/(dashboard)/minigames/[id]/page.tsx`, add the import at the top:

```tsx
import { GameResultOverlay } from "@/components/minigames/GameResultOverlay";
```

In the `MinigameSessionPage` function body (after the existing state declarations around line 1180), add:

```tsx
const [h2h, setH2h] = useState<{ wins: number; losses: number; draws: number } | null>(null);
```

- [ ] **Step 2: Add the `h2h` fetch effect to `MinigameSessionPage`**

Add this `useEffect` directly after the existing confetti/sound effect (`useEffect` ending around line 1224):

```tsx
useEffect(() => {
  if (!session || session.status !== "FINISHED") return;
  const opponent = session.myRole === "host" ? session.guest : session.host;
  if (!opponent) return;
  apiFetch<{ data: { wins: number; losses: number; draws: number } }>(
    `/api/minigames/stats?opponentId=${opponent.id}`
  )
    .then(r => setH2h(r.data))
    .catch(() => {});
}, [session?.status, session?.guest?.id, session?.host?.id]);
```

- [ ] **Step 3: Render `GameResultOverlay` in the page JSX**

In the `return` block of `MinigameSessionPage`, directly after the `{showHelp && <HowToPlayModal ... />}` line (around line 1272), add:

```tsx
{session.status === "FINISHED" && session.myRole !== "spectator" && (
  <GameResultOverlay
    session={session}
    myId={dbUser?.id}
    h2h={h2h}
    onNavigate={router.push}
  />
)}
```

- [ ] **Step 4: Remove the old inline result banner inside the board**

In the board card div (around line 1305), find and remove this block entirely — it is now replaced by the overlay:

```tsx
{session.status === "FINISHED" && (() => {
  const won = !!dbUser && session.winnerId === dbUser.id;
  const draw = !session.winnerId;
  return (
    <div className={`mb-4 rounded-2xl py-4 text-center ${
      draw ? "bg-amber-50 border border-amber-200" :
      won ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
    }`}>
      <div className="text-4xl mb-1">{draw ? "🤝" : won ? "🏆" : "💪"}</div>
      <p className={`text-lg font-black ${draw ? "text-amber-700" : won ? "text-emerald-700" : "text-rose-600"}`}>
        {draw ? "It's a draw!" : won ? "Victory!" : "Good game!"}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">
        {draw ? "Evenly matched." : won ? "Nicely played." : "Better luck next time."}
      </p>
    </div>
  );
})()}
```

- [ ] **Step 5: Remove `h2h` state and fetch from `RightPanel`**

Inside the `RightPanel` function (around line 987–1003), remove these three things:

```tsx
// Remove this state:
const [h2h, setH2h] = useState<{ wins: number; losses: number; draws: number } | null>(null);

// Remove this effect:
useEffect(() => {
  if (session.status !== "FINISHED" || !opponent) return;
  apiFetch<{ data: { wins: number; losses: number; draws: number } }>(`/api/minigames/stats?opponentId=${opponent.id}`)
    .then(r => setH2h(r.data))
    .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [session.status, opponent?.id]);

// Remove this usage (the h2h block inside the FINISHED section around line 1100):
{h2h && opponent && (h2h.wins + h2h.losses + h2h.draws) > 0 && (
  <p className="text-center text-xs text-gray-500">
    vs {opponent.displayName}:{" "}
    <span className="font-bold text-gray-700">
      {h2h.wins}–{h2h.losses}{h2h.draws > 0 ? `–${h2h.draws}` : ""}
    </span>
    {h2h.wins > h2h.losses ? " · you lead" : h2h.wins < h2h.losses ? " · you trail" : " · all square"}
  </p>
)}
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/minigames/\[id\]/page.tsx
git commit -m "feat(minigames): wire GameResultOverlay, lift h2h fetch to page level"
```

---

## Task 3: Animated turn indicator (`WaitingDots` + `RightPanel` + `MobileBar`)

**Files:**
- Modify: `app/(dashboard)/minigames/[id]/page.tsx`

- [ ] **Step 1: Add `WaitingDots` helper component**

Add this small component near the top of the file, just after the `Avatar` component definition (around line 52):

```tsx
// Animates · → · · → · · · to show the inactive player is waiting.
function WaitingDots() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);
  return <span aria-hidden>{"·".repeat(tick + 1)}</span>;
}
```

- [ ] **Step 2: Update `RightPanel` — replace the static players card + status badge**

Find the `{/* Players */}` block inside `RightPanel` (lines ~1039–1074) and replace it entirely with:

```tsx
{/* Players — active player glows, inactive dims */}
<div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
  {/* Me */}
  <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 transition-opacity ${session.status === "ACTIVE" && !isMyTurn ? "opacity-50" : ""}`}>
    <div className={session.status === "ACTIVE" && isMyTurn ? "rounded-full ring-4 ring-indigo-100" : "rounded-full"}>
      {me ? <Avatar player={me} /> : <div className="w-10 h-10 rounded-full bg-gray-100" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 truncate">{me?.displayName ?? "You"}</p>
      {session.status === "ACTIVE" && isMyTurn ? (
        <p className="text-xs text-indigo-600 font-semibold">▶ Your turn</p>
      ) : session.status === "ACTIVE" ? (
        <p className="text-xs text-gray-400">Waiting <WaitingDots /></p>
      ) : (
        <p className="text-xs text-gray-400">{session.myRole === "host" ? "Host · X / ●1" : "Guest · O / ●2"}</p>
      )}
    </div>
    <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">You</span>
  </div>

  {/* Vs divider */}
  <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50">
    <div className="flex-1 h-px bg-gray-200" />
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">vs</span>
    <div className="flex-1 h-px bg-gray-200" />
  </div>

  {/* Opponent */}
  <div className={`flex items-center gap-3 px-4 py-3 transition-opacity ${session.status === "ACTIVE" && isMyTurn ? "opacity-50" : ""}`}>
    {opponent ? (
      <div className={session.status === "ACTIVE" && !isMyTurn ? "rounded-full ring-4 ring-indigo-100" : "rounded-full"}>
        <Avatar player={opponent} />
      </div>
    ) : (
      <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">?</div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 truncate">{opponent?.displayName ?? "Waiting…"}</p>
      {session.status === "ACTIVE" && !isMyTurn ? (
        <p className="text-xs text-indigo-600 font-semibold">▶ Their turn</p>
      ) : session.status === "ACTIVE" ? (
        <p className="text-xs text-gray-400">Waiting <WaitingDots /></p>
      ) : (
        <p className="text-xs text-gray-400">{session.myRole === "host" ? "Guest · O / ●2" : "Host · X / ●1"}</p>
      )}
    </div>
  </div>
</div>

{/* Status badge — only shown while waiting for opponent */}
{session.status === "WAITING" && (
  <div className="rounded-xl px-4 py-2.5 text-center text-sm font-bold text-gray-600 bg-gray-100">
    Waiting for opponent…
  </div>
)}
```

> **Note:** The `statusColor` and `statusLabel` variables in `RightPanel` can be left in place (they're still used by the finished actions section) or removed if unused after this change. TypeScript will warn if they become unused.

- [ ] **Step 3: Update `MobileBar` — add avatar ring + turn label in the compact row**

Find the compact players row inside `MobileBar` (the `<div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">` block around line 899) and replace it with:

```tsx
<div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
  {/* Me */}
  <div className={`rounded-full shrink-0 ${session.status === "ACTIVE" && isMyTurn ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}>
    <Avatar player={me ?? session.host} size={28} />
  </div>
  <div className="flex flex-col min-w-0" style={{ maxWidth: 80 }}>
    <span className="text-sm font-semibold text-gray-900 truncate">{me?.displayName ?? "You"}</span>
    {session.status === "ACTIVE" && isMyTurn && (
      <span className="text-[9px] text-indigo-600 font-bold leading-tight">● Your turn</span>
    )}
  </div>

  <span className="text-[10px] text-gray-400 shrink-0">vs</span>

  {/* Opponent */}
  <div className={`rounded-full shrink-0 ${session.status === "ACTIVE" && !isMyTurn && opponent ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}>
    {opponent
      ? <Avatar player={opponent} size={28} />
      : <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300" />}
  </div>
  <div className="flex flex-col flex-1 min-w-0" style={{ maxWidth: 80 }}>
    <span className="text-sm font-semibold text-gray-900 truncate">{opponent?.displayName ?? "Waiting…"}</span>
    {session.status === "ACTIVE" && !isMyTurn && opponent && (
      <span className="text-[9px] text-indigo-600 font-bold leading-tight">● Their turn</span>
    )}
  </div>

  {/* Status pill — only for WAITING/FINISHED states */}
  {session.status !== "ACTIVE" && (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>{statusLabel}</span>
  )}
</div>
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/minigames/\[id\]/page.tsx
git commit -m "feat(minigames): animated turn indicator with avatar glow and waiting dots"
```

---

## Task 4: `ForfeitModal` — replace `confirm()` with styled modal

**Files:**
- Modify: `app/(dashboard)/minigames/[id]/page.tsx`

- [ ] **Step 1: Add `ForfeitModal` component**

Add this component after the `WaitingDots` component you added in Task 3:

```tsx
function ForfeitModal({
  opponentName,
  confirming,
  onConfirm,
  onCancel,
}: {
  opponentName: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center">
        <div className="text-4xl mb-3">🏳️</div>
        <h3 className="text-lg font-black text-gray-900 mb-2">Forfeit Game?</h3>
        <p className="text-sm text-gray-500 mb-6">
          {opponentName} will be declared the winner.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 border border-red-200 font-bold text-sm rounded-xl transition-colors"
          >
            {confirming ? "Forfeiting…" : "Yes, forfeit"}
          </button>
          <button
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 disabled:opacity-60 text-gray-700 border border-gray-200 text-sm rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `showForfeitModal` state to `MinigameSessionPage`**

In `MinigameSessionPage`, add this state alongside the other state declarations:

```tsx
const [showForfeitModal, setShowForfeitModal] = useState(false);
```

- [ ] **Step 3: Update the `forfeit()` function to use the modal instead of `confirm()`**

Find the `forfeit` function in `MinigameSessionPage` (around line 1244). Replace it entirely:

```tsx
async function forfeit() {
  if (!session || forfeiting) return;
  setShowForfeitModal(true);
}

async function executeForfeit() {
  if (!session) return;
  setShowForfeitModal(false);
  setForfeiting(true);
  try {
    await apiFetch(`/api/minigames/sessions/${id}/forfeit`, { method: "POST" });
    await fetchSession();
  } finally {
    setForfeiting(false);
  }
}
```

- [ ] **Step 4: Render `ForfeitModal` in the page JSX**

In the `return` block of `MinigameSessionPage`, alongside the `HowToPlayModal` render (around line 1272), add:

```tsx
{showForfeitModal && session && (
  <ForfeitModal
    opponentName={
      (session.myRole === "host" ? session.guest?.displayName : session.host.displayName) ?? "Your opponent"
    }
    confirming={forfeiting}
    onConfirm={executeForfeit}
    onCancel={() => setShowForfeitModal(false)}
  />
)}
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/minigames/\[id\]/page.tsx
git commit -m "feat(minigames): replace confirm() with styled ForfeitModal"
```

---

## Task 5: Mobile board sizing

**Files:**
- Modify: `app/(dashboard)/minigames/[id]/page.tsx`

- [ ] **Step 1: Fix Connect Four board width**

In `C4Board` (around line 263), find:

```tsx
<div className="bg-indigo-700 p-2 sm:p-2.5 rounded-2xl shadow-md w-full" style={{ width: "min(100%, 320px)" }}>
```

Replace with:

```tsx
<div className="bg-indigo-700 p-2 sm:p-2.5 rounded-2xl shadow-md w-full" style={{ width: "min(100%, calc(100vw - 32px))" }}>
```

- [ ] **Step 2: Fix Dots & Boxes board width**

In `DnBBoard` (around line 513), find:

```tsx
style={{
  gridTemplateColumns: Array.from({ length: gridCols }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
  gridTemplateRows: Array.from({ length: gridRows }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
  width: "min(100%, 360px)",
  aspectRatio: "1",
}}
```

Replace with:

```tsx
style={{
  gridTemplateColumns: Array.from({ length: gridCols }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
  gridTemplateRows: Array.from({ length: gridRows }, (_, i) => i % 2 === 0 ? "12px" : "1fr").join(" "),
  width: "min(100%, calc(100vw - 32px))",
  aspectRatio: "1",
}}
```

- [ ] **Step 3: Fix Battleship grid max-width (battle phase)**

In `BSGrid` (around line 594), find:

```tsx
<div className="w-full" style={{ maxWidth: "320px" }}>
```

Replace with:

```tsx
<div className="w-full overflow-x-auto" style={{ maxWidth: "min(320px, calc(100vw - 32px))" }}>
```

- [ ] **Step 4: Fix Battleship grid max-width (placement phase)**

In `BSBoard`'s placement section (around line 661), find:

```tsx
<div className="grid gap-0.5 w-full" style={{ gridTemplateColumns: `repeat(${BS_GRID}, 1fr)`, maxWidth: "320px" }}>
```

Replace with:

```tsx
<div className="grid gap-0.5 w-full" style={{ gridTemplateColumns: `repeat(${BS_GRID}, 1fr)`, maxWidth: "min(320px, calc(100vw - 32px))" }}>
```

- [ ] **Step 5: Reduce board card padding on mobile**

In `MinigameSessionPage`'s board card (around line 1305), find:

```tsx
<div className={`w-full lg:flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl p-3 lg:p-6 transition-opacity ${moving ? "opacity-70 pointer-events-none" : ""}`}>
```

Replace `p-3` with `p-2`:

```tsx
<div className={`w-full lg:flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl p-2 lg:p-6 transition-opacity ${moving ? "opacity-70 pointer-events-none" : ""}`}>
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/minigames/\[id\]/page.tsx
git commit -m "fix(minigames): mobile board sizing — fill viewport width on small screens"
```

---

## Verification

After all tasks are complete, test these flows end-to-end:

1. **Result overlay (win):** Play a Connect Four game to a win. The dark indigo overlay should appear with 🏆, "Victory!", points delta, and the h2h record. Rematch button navigates to a new session. Lobby button goes to `/minigames`.

2. **Result overlay (draw):** Force a Tic-Tac-Toe draw (fill all 9 cells). Amber gradient overlay with 🤝 and "It's a Draw!" should appear.

3. **Turn indicator (desktop):** Start an active game. The current player's avatar should have an indigo ring with "▶ Your turn" below their name. The waiting player should be at 50% opacity with "Waiting ·" animating to "· · ·".

4. **Turn indicator (mobile):** Same game on a narrow viewport. The active player's avatar in the compact bar should have an indigo ring and "● Your turn" below their name.

5. **Forfeit modal:** During an active game, click "Forfeit game". The styled modal should appear (no browser dialog). Clicking Cancel dismisses it. Clicking "Yes, forfeit" ends the game and triggers the result overlay.

6. **Mobile boards:** Open Connect Four and Battleship on a phone-width viewport (≤375px). Boards should fill available width without cramped cells.
