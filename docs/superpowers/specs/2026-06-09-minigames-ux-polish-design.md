# Minigames UX Polish — Design Spec

**Date:** 2026-06-09
**Status:** Approved

## Context

The minigames feature has 6 fully working games with real-time multiplayer, wagering, and stats. The core gameplay is solid, but three in-game UX moments fall flat:

1. **Game result** — a small colored banner inside the board; underwhelming for a win, forgettable for a loss.
2. **Turn indicator** — a static text badge ("Your turn" / "Their turn") with no visual emphasis on who's active.
3. **Forfeit confirmation** — uses the browser's native `confirm()` dialog, which looks inconsistent and unprofessional.

Additionally, game boards on mobile are cramped because they use fixed max-widths designed for desktop.

All four improvements are purely frontend — no API or database changes required.

---

## Changes

### 1. Full-Screen Result Overlay (`GameResultOverlay`)

**File:** `components/minigames/GameResultOverlay.tsx` (new)
**Wired in:** `app/(dashboard)/minigames/[id]/page.tsx`

A full-viewport overlay that fires the instant `session.status` transitions to `"FINISHED"`. It replaces the existing inline result banner inside the board container (currently lines ~1306–1323 in `[id]/page.tsx`).

**Design:**
- `fixed inset-0 z-50` dark gradient backdrop (indigo-dark for win, near-black for loss, amber-dark for draw)
- Centered card with:
  - Large emoji: 🏆 (win) / 💪 (loss) / 🤝 (draw)
  - Title: "Victory!" / "Good Game" / "It's a Draw!"
  - Game type label (e.g. "Connect Four")
  - Points delta: `+N pts` in indigo/green, `−N pts` in red, `±0 pts` in amber (only shown if `pointsWager > 0`)
  - Head-to-head line: "vs {opponent} · you lead 6–3" (loaded via existing `stats?opponentId=` endpoint)
  - Two buttons: **Rematch** (primary) + **Lobby** (secondary)
- Fade-in + slight scale-up animation on mount
- Confetti and sound already fire at the right moment via existing hooks — the overlay wraps that moment visually

**Props:**
```ts
{
  session: Session
  myId: string | undefined
  onRematch: () => void     // existing startRematch logic
  onAcceptRematch: () => void
  onLobby: () => void
  rematchId?: string
  iStartedRematch: boolean
  rematching: boolean
}
```

---

### 2. Animated Turn Indicator

**File:** `app/(dashboard)/minigames/[id]/page.tsx`
**Components affected:** `RightPanel` players card, `MobileBar` compact row

Replace the static status badge with a player card where the active player is visually distinguished from the waiting one.

**Desktop (RightPanel):**
- Active player: indigo ring (`border-indigo-500 ring-4 ring-indigo-100`) on avatar, "▶ Your turn" / "▶ Their turn" label in indigo below name
- Inactive player: `opacity-50`, "Waiting · · ·" with CSS animated dots below name

**Mobile (MobileBar):**
- Active player avatar gets `border-2 border-indigo-500` ring
- "● Your turn" label in indigo replaces the plain status pill for that player

**CSS for animated dots:**
```css
@keyframes dots {
  0%, 20%  { content: '·'; }
  40%      { content: '· ·'; }
  60%, 80% { content: '· · ·'; }
  100%     { content: '·'; }
}
```
Implemented as a `<span>` toggling between "·", "· ·", "· · ·" via a `useEffect` interval, or a simple CSS animation trick.

---

### 3. Forfeit Confirmation Modal (`ForfeitModal`)

**File:** `app/(dashboard)/minigames/[id]/page.tsx` (inline component or separate file)

Replaces `confirm("Forfeit this game? Your opponent will win.")` in the `forfeit()` function.

**State added to `MinigameSessionPage`:**
```ts
const [showForfeitModal, setShowForfeitModal] = useState(false)
```

**Flow:**
1. Player clicks "Forfeit game" → `setShowForfeitModal(true)` (no `confirm()`)
2. Modal renders with opponent name
3. "Yes, forfeit" → calls existing `forfeit()` logic → closes modal
4. "Cancel" → `setShowForfeitModal(false)`

**Design:**
- `fixed inset-0 z-40 bg-black/40` backdrop
- Centered white card, `rounded-2xl shadow-2xl p-6`
- 🏳️ emoji, "Forfeit Game?" title, "{opponent.displayName} will be declared the winner."
- Two buttons: "Yes, forfeit" (red-toned) + "Cancel" (neutral)

---

### 4. Mobile Board Sizing

**File:** `app/(dashboard)/minigames/[id]/page.tsx`

**Connect Four (`C4Board`):**
- Change `style={{ width: "min(100%, 320px)" }}` → `style={{ width: "min(100%, calc(100vw - 32px))" }}`

**Battleship (`BSBoard`):**
- Same pattern on the outer grid container; add `overflow-x-auto` as fallback for very small viewports

**Dots & Boxes (`DnBBoard`):**
- Same pattern if a fixed max-width is present

**Board container (main layout):**
- Change `p-3 lg:p-6` → `p-2 lg:p-6` on the board card to reclaim ~8px of usable width on mobile

No changes to Memory or Tic-Tac-Toe — they scale fine already.

---

## Files Changed

| File | Change |
|------|--------|
| `components/minigames/GameResultOverlay.tsx` | New component |
| `app/(dashboard)/minigames/[id]/page.tsx` | Wire overlay, update RightPanel + MobileBar turn indicator, inline ForfeitModal, board sizing |

## No Backend Changes

All four improvements are purely frontend. Existing API endpoints, DB schema, and real-time logic are untouched.

---

## Verification

1. **Result overlay** — play a game to completion (win, lose, draw). Overlay should appear full-screen immediately on finish. Confetti fires on win. Rematch button works. Lobby button navigates to `/minigames`.
2. **Turn indicator** — during an active game, confirm the active player has the indigo ring and "▶ Your turn" label; the waiting player is dimmed with "Waiting · · ·".
3. **Forfeit modal** — click "Forfeit game" during an active game. Styled modal appears (no browser dialog). Cancel dismisses it. "Yes, forfeit" ends the game.
4. **Mobile boards** — open an active Connect Four or Battleship game on a phone or narrow viewport. Board should fill the screen width without horizontal scroll (or scroll gracefully for Battleship on very small screens).
