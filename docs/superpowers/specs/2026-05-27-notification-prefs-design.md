# Notification Preferences — Design Spec

**Date:** 2026-05-27
**Feature:** In-app notification type toggles per user

---

## Overview

Users can opt out of specific in-app notification types. Preferences are stored as a JSON field on the User model. The `createNotification` helper checks prefs before inserting — silently skipping if the user has opted out. A "Notifications" tab on the profile page exposes the toggles.

---

## Toggleable Notification Types

| Type key | When it fires |
|---|---|
| `SHOUTOUT_RECEIVED` | Someone sends you a shoutout |
| `MISSION_COMPLETED` | Your mission completion is approved |
| `POINTS_AWARDED` | Admin manually awards you points |
| `MILESTONE_REWARD` | Birthday or work anniversary reward fires |

Default for all types: **enabled** (opt-out model).

---

## Schema Change

Add one field to `User`:

```prisma
notificationPrefs Json?   // null = all defaults (all on)
```

Shape when set:
```json
{
  "SHOUTOUT_RECEIVED": true,
  "MISSION_COMPLETED": false,
  "POINTS_AWARDED": true,
  "MILESTONE_REWARD": true
}
```

Missing keys default to `true`. A `null` field means all defaults (all on) — no migration needed for existing users.

---

## Architecture

### `createNotification` helper — updated

Before creating a notification, load the user's `notificationPrefs` and check if the type is enabled:

```typescript
export async function createNotification(params: CreateNotificationParams) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { notificationPrefs: true },
  });
  const prefs = (user?.notificationPrefs ?? {}) as Record<string, boolean>;
  // If the type is explicitly set to false, skip
  if (prefs[params.type] === false) return null;
  return prisma.notification.create({ data: params });
}
```

Only notification types listed above are checked. All other types (e.g., custom admin messages) always go through.

### API — `GET /api/me/notification-preferences`

- Auth: any authenticated user
- Returns current prefs merged with defaults:
  ```json
  {
    "data": {
      "SHOUTOUT_RECEIVED": true,
      "MISSION_COMPLETED": true,
      "POINTS_AWARDED": true,
      "MILESTONE_REWARD": true
    }
  }
  ```

### API — `PUT /api/me/notification-preferences`

- Auth: any authenticated user
- Body: partial object `{ [type: string]: boolean }`
- Merges into existing `notificationPrefs` JSON (does not overwrite unknown keys)
- Validates that submitted keys are in the allowed set
- Returns updated merged prefs

### UI — Notifications tab in profile page

- New tab `"notifications"` added to `app/(dashboard)/profile/page.tsx`
- Tab label: "Notifications" (Bell icon)
- Content: one toggle row per notification type
  - Label + description
  - Toggle switch (HTML checkbox styled as toggle)
- On toggle change: debounce-free immediate `PUT /api/me/notification-preferences` with `{ [type]: newValue }`
- Optimistic update: toggle flips immediately, rolls back on error
- Loading state: disabled toggles with subtle opacity while saving

---

## Data Flow

```
User visits Profile → Notifications tab
  → GET /api/me/notification-preferences
  → renders toggles with current values

User flips toggle
  → optimistic UI update
  → PUT /api/me/notification-preferences { [type]: value }
  → server merges into User.notificationPrefs JSON
  → success: no UI change (already optimistic)
  → error: revert toggle + show toast

createNotification called anywhere in codebase
  → loads user.notificationPrefs
  → checks type key
  → skips if false, proceeds if true or missing
```

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `notificationPrefs Json?` to User |
| `lib/helpers/createNotification.ts` | Modify — check prefs before insert |
| `app/api/me/notification-preferences/route.ts` | New — GET + PUT |
| `app/(dashboard)/profile/page.tsx` | Modify — add Notifications tab |

---

## Error Handling

- Unknown type keys in PUT body: reject with 400
- DB failure in createNotification pref check: fail open (proceed with notification)
- Toggle save failure: revert optimistic state, show "Failed to save preference" toast

---

## Non-Goals

- No email notification channel (in-app only)
- No push notifications
- No per-notification granularity beyond the 4 types listed
