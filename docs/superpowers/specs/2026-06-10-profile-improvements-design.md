# Profile Page Improvements — Design Spec

**Date:** 2026-06-10
**Status:** Approved

## Context

The profile page now has a two-column sticky sidebar layout. This spec covers three groups of improvements to fill remaining gaps: pure frontend enhancements (no API changes), new API-fetched widgets, and a custom banner upload feature (requires DB migration).

Public profile view was scoped out — it already exists at `/employees/[id]`.

---

## Group 1: Pure Frontend Enhancements

### 1. Tenure Badge

**Where:** Profile card, inline with role and department pills.

**Logic:** Calculate years from `profile.hireDate`. If `hireDate` is null, render nothing.

```ts
const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
```

**UI:** Small pill `"3 yrs at AGS"`. Style: `bg-teal-50 text-teal-700` to visually distinguish from role/dept pills.

**Edge case:** If less than 1 year, show `"< 1 yr at AGS"`.

---

### 2. Streak Context Nudge

**Where:** Below the streak value in the Streak stat card (Overview tab).

**Logic:**
- `streakDays > 0` → `"Log in tomorrow to keep it going!"`
- `streakDays === 0` → `"Log in daily to start a streak!"`

**UI:** `text-xs text-zinc-400 mt-1` below the existing `"Streak (days)"` label.

---

### 3. Recent Badges Sidebar Widget

**Where:** Right sidebar, below Upcoming Milestone widget.

**Data:** `profile.userBadges` — already loaded. Sort by `awardedAt` descending, take 2.

**UI:**
- Header: "Recent Badges" with "See all →" button that switches `activeTab` to `"badges"`
- Each row: Award icon + badge name + awarded date
- Hidden entirely if `profile.userBadges.length === 0`

---

### 4. Upcoming Milestone Sidebar Widget

**Where:** Right sidebar, first widget (above Dept Rank).

**Data:** `profile.birthday` and `profile.hireDate` — already loaded.

**Logic:**
- Calculate `daysUntil` for birthday (month+day match, year-agnostic)
- Calculate `daysUntil` for next work anniversary (month+day match, show year number e.g. "3rd")
- Show any milestone within 30 days
- If both are within 30 days, show both
- If neither, hide widget

**Ordinal suffix helper:** `1st`, `2nd`, `3rd`, `4th+`

**UI:**
- Birthday: `"🎂 Birthday in 3 days"`
- Anniversary: `"🎉 3rd anniversary in 14 days"`
- Style: `bg-white rounded-xl border border-zinc-200 px-5 py-4`

---

## Group 2: New API Fetches

### 5. Shoutouts Received (Overview Tab)

**New endpoint:** `GET /api/me/shoutouts`

**Query:**
```ts
prisma.shoutoutRecipient.findMany({
  where: { userId: authUser.id },
  include: {
    post: {
      include: {
        author: { select: { id, displayName, avatarUrl, department: { select: { name } } } },
        shoutoutRecipients: { include: { user: { select: { id, displayName, avatarUrl } } } },
      },
    },
  },
  orderBy: { post: { createdAt: "desc" } },
  take: 5,
})
```

**Response:** `{ data: ShoutoutRecipient[] }`

**Where (frontend):** Below Skills section in Overview tab.

**UI:**
- Section header: `"💬 Shoutouts"` with `"See all →"` linking to `/feed`
- Each entry: Author avatar + name + shoutout text (truncated to 2 lines) + date
- Empty state: `"No shoutouts yet — complete missions and someone might recognize you!"`
- Always rendered (no hide-if-empty — the empty state is motivating)

**New state:** `const [shoutouts, setShoutouts] = useState<ShoutoutEntry[] | null>(null)`

**Fetch:** Added to `Promise.all` in the initial `useEffect` alongside `/api/me` and `/api/me/points`.

---

### 6. Active Missions Progress (Overview Tab)

**Data:** Fetch `GET /api/missions` — already returns `myCompletion` per mission.

**Where (frontend):** Below Minigames Stats card in Overview tab.

**Filter logic:**
- Show missions where `myCompletion === null` (not yet submitted) — label: "In Progress"
- Show missions where `myCompletion.status === "PENDING"` — label: "Pending Review"
- Max 3 shown
- Hidden if no matching missions

**UI:**
- Header: `"🎯 Active Missions"`
- Each row: Mission title + points reward + status chip
- Status chips: `"In Progress"` (blue) / `"Pending Review"` (amber)
- "Go to Dashboard →" link at bottom

**New state:** `const [missions, setMissions] = useState<Mission[] | null>(null)`

**Fetch:** Added to `Promise.all` in the initial `useEffect` alongside other fetches. On failure, `missions` stays `null` and widget is hidden — no error shown.

---

## Group 3: Custom Banner Upload

### 7. DB Migration

Add to `prisma/schema.prisma` User model:
```prisma
bannerUrl  String?
```

Run: `npx prisma migrate dev --name add-user-banner-url`

---

### 8. API Changes

**`GET /api/me`** — add `bannerUrl` to the Prisma select.

**`PATCH /api/me`** — add `bannerUrl` to allowed fields. Accept as `string | null`.

---

### 9. Frontend — Profile Card Header

**Current:** Static gradient div, 96px tall.

**New behavior:**
- If `profile.bannerUrl` exists: render as `object-cover` image behind a semi-transparent gradient overlay (so text/avatar remain readable)
- On hover: camera icon overlay (`bg-black/30 opacity-0 group-hover:opacity-100`)
- Click anywhere on header → triggers hidden `<input type="file" accept="image/*">`

**Upload flow:**
1. User clicks header → file picker opens
2. File selected → show spinner overlay on header (`bannerUploading` state)
3. Call `uploadToCloudinary(file)` from `lib/cloudinary/upload.ts`
4. On success: PATCH `/api/me` with `{ bannerUrl: secureUrl }`
5. Update local `profile` state → spinner clears, new banner renders

**New state:**
```ts
const [bannerUploading, setBannerUploading] = useState(false);
const bannerInputRef = useRef<HTMLInputElement>(null);
```

**New imports:** `Camera` from lucide-react, `useRef` from react, `uploadToCloudinary` from `@/lib/cloudinary/upload`.

**Error handling:** On upload failure, show a brief toast-style error (inline `bannerError` state, auto-clears after 3s). No destructive action on failure — existing banner (or gradient) remains.

---

## Files to Modify

| File | Change |
|------|--------|
| `app/(dashboard)/profile/page.tsx` | All frontend changes (Groups 1, 2, 3) |
| `app/api/me/route.ts` | Add `bannerUrl` to GET select + PATCH handler |
| `app/api/me/shoutouts/route.ts` | **New file** — shoutouts received endpoint |
| `prisma/schema.prisma` | Add `bannerUrl String?` to User model |

---

## Verification

1. **Tenure badge:** Profile card shows tenure pill for users with hire date; hidden for users without
2. **Streak nudge:** Stat card shows correct hint text for streak > 0 and streak = 0
3. **Sidebar — Recent Badges:** Shows last 2 badges; "See all →" switches to Badges tab; hidden with no badges
4. **Sidebar — Upcoming Milestone:** Shows birthday/anniversary within 30 days; hidden otherwise; both shown if both qualify
5. **Shoutouts:** Section renders in Overview; shows received shoutouts; empty state visible when none
6. **Missions:** Active missions shown below Minigames card; hidden if none active/pending
7. **Banner upload:** Click header → file picker → Cloudinary upload → banner renders; spinner during upload; error message on failure
8. **All tabs:** Sidebar widgets remain visible across all 4 tabs
