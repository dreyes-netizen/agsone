# Peer Recognition (Shoutouts) — Design Spec
_Date: 2026-05-23_

## Overview

Any employee can tag a colleague with a public shoutout that posts to the Feed. Shoutouts are free (no points deducted from sender). They appear with distinct visual treatment and the recipient is notified. Managers can attach a point award when posting a shoutout by leveraging the existing award flow.

---

## 1. Data Layer

### Schema changes

**`PostType` enum** — add `SHOUTOUT` variant:
```prisma
enum PostType {
  UPDATE
  POLL
  SHOUTOUT
}
```

**`SocialPost` model** — add `recipientId`:
```prisma
recipientId String?
recipient   User?   @relation("ShoutoutsReceived", fields: [recipientId], references: [id])
```

**`User` model** — add back-relation:
```prisma
shoutoutsReceived SocialPost[] @relation("ShoutoutsReceived")
```

### API changes

**`POST /api/feed`** — extend to handle `type: "SHOUTOUT"`:
- Validate `recipientId` is present and not the sender
- Create `SocialPost` with `type: SHOUTOUT`, `content`, `recipientId`
- Create `Notification` for recipient: type `"SHOUTOUT_RECEIVED"`, title `"{sender} gave you a shoutout!"`

**`GET /api/feed`** — include `recipient: { select: { id, displayName, avatarUrl } }` in the query.

---

## 2. Employee UI

### Feed page (`/feed`)

**"Give Shoutout" button** — top right of the Feed page, next to any existing post button. Opens an inline form (no modal).

**Shoutout form fields:**
- Recipient — searchable dropdown of all employees (`GET /api/employees` or existing endpoint)
- Message — textarea (required, max 500 chars)
- Submit "Send Shoutout" button

**Shoutout card** — visually distinct from regular posts:
- Amber/gold accent strip at top (vs. indigo for regular posts)
- Header: `"{Sender} gave a shoutout to {Recipient}"` with both avatars
- Message body
- Reactions (existing `SocialReaction` system — no change)
- Timestamp

**Feed filter** — add "Shoutouts" tab alongside existing filters (All / Updates / Shoutouts).

### Notifications
Recipient gets an in-app notification via existing `createNotification` helper. No email in v1.

---

## 3. Rules & Edge Cases

- Sender cannot shoutout themselves — API returns 400
- `recipientId` is required for `type: SHOUTOUT` — API returns 400 if missing
- No point transfer in v1 — shoutouts are purely social
- Shoutouts appear in the main Feed (not a separate page)
- Reactions and comments work exactly as on regular posts (no changes needed)

---

## 4. Files Changed

### New/modified files
```
prisma/schema.prisma                    — add SHOUTOUT to PostType, add recipientId to SocialPost
app/api/feed/route.ts                   — handle type=SHOUTOUT in POST, include recipient in GET
app/(dashboard)/feed/page.tsx           — add Shoutout form + Shoutouts tab + shoutout card UI
```

---

## 5. Out of Scope (v1)

- Point transfer on shoutout
- Shoutout-specific analytics / leaderboard
- Email notifications
- Manager-only shoutouts (any employee can give one)
