# Email Notifications — Design Spec

**Date:** 2026-05-27
**Feature:** Extend in-app notification preferences to include email delivery for 4 event types

---

## Overview

Reuse the existing `notificationPrefs Json?` field on User to store email opt-in flags alongside in-app toggles. Email delivery is opt-in (default false). `createNotification` fires emails fire-and-forget using a new generic template. The Notifications tab on the profile page gains an Email toggle column.

---

## Pref Key Convention

Email prefs use `_EMAIL` suffix on the existing type keys:

| In-app key (existing) | Email key (new) | Default |
|---|---|---|
| `SHOUTOUT_RECEIVED` | `SHOUTOUT_RECEIVED_EMAIL` | false |
| `MISSION_COMPLETED` | `MISSION_COMPLETED_EMAIL` | false |
| `POINTS_AWARDED` | `POINTS_AWARDED_EMAIL` | false |
| `MILESTONE_REWARD` | `MILESTONE_REWARD_EMAIL` | false |

No schema migration needed — email keys live in the same `notificationPrefs Json?` field.

---

## Email Template

New `notificationEmail(displayName, title, body)` function added to `lib/email/templates.ts`:
- Subject: the notification `title`
- Body: greeting + body text + "Go to Dashboard →" CTA button
- Uses the existing `layout()` wrapper and `BRAND_COLOR`

---

## `createNotification` Update

After the existing in-app pref check, also:
1. Load user's `email` and `displayName` in the same `findUnique` call (extend the `select`)
2. Check `prefs[TYPE_EMAIL]` — if explicitly `true` and user has an email, call `sendMail` fire-and-forget (`.catch(() => {})`)
3. Email sending failure never blocks in-app notification creation

```
createNotification called
  → check in-app pref (existing logic, skip if false)
  → check email pref (TYPE_EMAIL key)
  → if true: fire sendMail(...).catch(() => {})  ← non-blocking
  → always: prisma.notification.create(...)
```

---

## API Update — `GET/PUT /api/me/notification-preferences`

Add 4 `_EMAIL` keys to `TOGGLEABLE_TYPES` with `false` as default:

```typescript
const DEFAULTS = {
  SHOUTOUT_RECEIVED: true,
  MISSION_COMPLETED: true,
  POINTS_AWARDED: true,
  MILESTONE_REWARD: true,
  SHOUTOUT_RECEIVED_EMAIL: false,
  MISSION_COMPLETED_EMAIL: false,
  POINTS_AWARDED_EMAIL: false,
  MILESTONE_REWARD_EMAIL: false,
};
```

GET returns all 8 keys merged with defaults. PUT accepts any subset of the 8 keys.

---

## Profile Page UI Update

Notifications tab changes from a single toggle per row to two toggles:

```
| Notification type       | In-App  | Email   |
|-------------------------|---------|---------|
| Shoutout received       | [toggle]| [toggle]|
| Mission approved        | [toggle]| [toggle]|
| Points awarded          | [toggle]| [toggle]|
| Milestone reward        | [toggle]| [toggle]|
```

- In-App column: existing toggle (calls PUT with `{ TYPE: value }`)
- Email column: new toggle (calls PUT with `{ TYPE_EMAIL: value }`)
- Each toggle is independent — optimistic update + revert on error
- Email toggles display as slightly smaller to visually distinguish

---

## File Map

| File | Action |
|---|---|
| `lib/email/templates.ts` | Add `notificationEmail(displayName, title, body)` |
| `lib/helpers/createNotification.ts` | Load email + check `_EMAIL` pref → fire `sendMail` |
| `app/api/me/notification-preferences/route.ts` | Add 4 `_EMAIL` keys to TOGGLEABLE_TYPES + DEFAULTS |
| `app/(dashboard)/profile/page.tsx` | Add Email toggle column to Notifications tab |

---

## Non-Goals

- No weekly digest in this phase
- No redemption status emails (separate feature)
- No per-notification rich templates (title+body is sufficient for now)
- No unsubscribe link (internal tool, employees manage from profile)
