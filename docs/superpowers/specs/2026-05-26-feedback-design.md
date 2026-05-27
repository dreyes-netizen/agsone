# Employee Feedback Design Spec
_Date: 2026-05-26_

## Goal

A private, two-way feedback channel between employees and HR admins. Employees submit structured feedback on any topic; HR triages, responds, and resolves threads. Anonymous submissions are supported but are one-way only (no HR replies).

---

## Architecture

Ticket-inbox model. Each submission is a `Feedback` record with a thread of `FeedbackReply` records. Employees manage their own submissions at `/feedback`. HR admins manage all submissions at `/admin/feedback`. Anonymous submissions store the `authorId` server-side for audit purposes but strip it from all HR-facing queries.

---

## Data Model

### New enum: `FeedbackCategory`
```prisma
enum FeedbackCategory {
  COMPENSATION_BENEFITS
  WORK_LIFE_BALANCE
  COMPANY_CULTURE
  TEAM_DYNAMICS
  PROCESSES_TOOLS
  RECOGNITION
  OTHER
}
```

### New enum: `FeedbackStatus`
```prisma
enum FeedbackStatus {
  OPEN
  IN_REVIEW
  RESOLVED
}
```

### New model: `Feedback`
```prisma
model Feedback {
  id          String           @id @default(uuid())
  authorId    String?
  isAnonymous Boolean          @default(false)
  category    FeedbackCategory
  title       String
  body        String
  status      FeedbackStatus   @default(OPEN)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  author  User?           @relation(fields: [authorId], references: [id])
  replies FeedbackReply[]
}
```

### New model: `FeedbackReply`
```prisma
model FeedbackReply {
  id         String   @id @default(uuid())
  feedbackId String
  authorId   String
  body       String
  createdAt  DateTime @default(now())

  feedback Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  author   User     @relation(fields: [authorId], references: [id])
}
```

### `User` model additions
```prisma
feedbacks       Feedback[]
feedbackReplies FeedbackReply[]
```

### Anonymity rule
When `isAnonymous = true`, `authorId` is stored in the DB. All HR-facing API routes (`/api/admin/feedback/*`) must **never** include `authorId`, `author.displayName`, or `author.avatarUrl` in their responses — strip at the query level using `select` (not post-processing). Employee-facing routes only return the employee's own submissions, so anonymity stripping is not needed there.

---

## Categories (display labels)

| Enum value | Display label |
|---|---|
| `COMPENSATION_BENEFITS` | Compensation & Benefits |
| `WORK_LIFE_BALANCE` | Work-Life Balance |
| `COMPANY_CULTURE` | Company Culture |
| `TEAM_DYNAMICS` | Team Dynamics |
| `PROCESSES_TOOLS` | Processes & Tools |
| `RECOGNITION` | Recognition |
| `OTHER` | Other |

---

## API Routes

### Employee routes (any authenticated user)

**`GET /api/feedback`**
- Returns all `Feedback` records where `authorId == currentUser.id`, ordered by `updatedAt desc`
- Includes `_count { replies }` and `updatedAt` (shows last activity time on card)
- Response: `{ data: FeedbackListItem[] }`

**`POST /api/feedback`**
- Body: `{ category, title, body, isAnonymous }`
- Validates: title max 150 chars, body max 1000 chars, category is valid enum
- Creates `Feedback` with `authorId = currentUser.id` (even if anonymous)
- Response: `{ data: Feedback }`

**`GET /api/feedback/[id]`**
- Returns full thread: `Feedback` + all `FeedbackReply` records ordered by `createdAt asc`
- 403 if `feedback.authorId !== currentUser.id`
- Each reply includes `author.displayName` and `author.avatarUrl`
- Response: `{ data: FeedbackThread }`

**`POST /api/feedback/[id]/replies`**
- Body: `{ body }` (max 1000 chars)
- 403 if `feedback.authorId !== currentUser.id`
- 400 if `feedback.isAnonymous === true` (anonymous threads cannot be replied to)
- Creates `FeedbackReply` with `authorId = currentUser.id`
- Sends notification to the HR admin who last replied on the thread (if any): title `"Employee replied to a feedback thread"`, body `"A reply was added to a feedback thread you responded to."`
- Response: `{ data: FeedbackReply }`

### HR Admin routes (HR_ADMIN only)

**`GET /api/admin/feedback`**
- Returns all `Feedback` records ordered by `updatedAt desc`
- Supports query params: `status` (filter by enum), `category` (filter by enum)
- For anonymous submissions: omit `authorId`, return `author: null`
- For non-anonymous: include `author: { displayName, avatarUrl }`
- Includes `_count { replies }` per thread
- Response: `{ data: FeedbackListItem[] }`

**`GET /api/admin/feedback/[id]`**
- Returns full thread + all replies
- For anonymous: `author` on the `Feedback` record is `null`; replies show actual author (HR admins only, so safe)
- Response: `{ data: FeedbackThread }`

**`POST /api/admin/feedback/[id]/replies`**
- Body: `{ body }` (max 1000 chars)
- 400 if `feedback.isAnonymous === true`
- Creates `FeedbackReply` with `authorId = currentUser.id`
- Sends notification to `feedback.authorId`: title `"HR responded to your feedback"`, body `"HR has replied to your feedback: \"{title}\"."`
- Auto-updates `feedback.status` to `IN_REVIEW` if currently `OPEN`
- Response: `{ data: FeedbackReply }`

**`PATCH /api/admin/feedback/[id]`**
- Body: `{ status }` (valid FeedbackStatus enum)
- Updates status
- If status changes to `RESOLVED`: sends notification to `feedback.authorId` (skip if anonymous): title `"Your feedback has been resolved"`, body `"HR has marked your feedback \"{title}\" as resolved."`
- Response: `{ data: { status } }`

---

## Employee UI (`/dashboard/feedback`)

### List page (`/feedback`)
- Header: "My Feedback" + "New Feedback" button (top right)
- Each card shows:
  - Category badge (colored by category)
  - Title
  - Status chip: `Open` (gray) / `In Review` (amber) / `Resolved` (green)
  - Date submitted
  - Last activity timestamp ("Last updated X ago")
- Empty state: "You haven't submitted any feedback yet."
- Add "Feedback" to dashboard sidebar nav between Profile and existing bottom items

### Submit form (modal)
- Fields: Title (text input, required, max 150), Category (select), Body (textarea, required, max 1000 with char counter), "Submit anonymously" toggle
- When anonymous toggle is on: show inline warning — *"Anonymous feedback cannot receive replies from HR."*
- Submit button disabled until title + body + category filled

### Thread page (`/feedback/[id]`)
- Original submission shown at top (title, category badge, status chip, body, date)
- Replies in chronological order — employee replies right-aligned, HR replies left-aligned (like a chat)
- Each reply: avatar, display name ("HR Team" for HR admins), body, timestamp
- Reply input at bottom (textarea + send button) — **hidden entirely if `isAnonymous === true`**
- No status controls (read-only for employees)

---

## HR Admin UI (`/admin/feedback`)

### Inbox page (`/admin/feedback`)
- Filter bar: Status tabs (`All` / `Open` / `In Review` / `Resolved`) + Category dropdown
- Table columns: Status | Category | Title | Submitted By ("Anonymous" if isAnonymous) | Date | Reply count
- Sorted by `updatedAt desc` (most recently active first)
- Unread indicator (bold row) when employee replied since HR last viewed
- Add "Feedback" to admin sidebar nav with badge showing count of `OPEN` threads

### Thread page (`/admin/feedback/[id]`)
- Same chat-style layout as employee thread view
- Status dropdown at top right: HR can select `Open` / `In Review` / `Resolved`
- "Submitted by" shows name + avatar for non-anonymous, "Anonymous Employee" with generic avatar for anonymous
- Reply input at bottom — **disabled with tooltip "Cannot reply to anonymous feedback"** if `isAnonymous === true`
- HR reply shows the HR admin's own name/avatar (not "HR Team" — admins should own their replies)

---

## Notifications

| Trigger | Recipient | Title | Body |
|---|---|---|---|
| HR replies to thread | Feedback author (skip if anonymous) | "HR responded to your feedback" | `HR has replied to your feedback: "{title}".` |
| Employee replies to thread | HR admin who last replied | "Employee replied to feedback" | `A reply was added to a feedback thread you responded to.` |
| HR marks as Resolved | Feedback author (skip if anonymous) | "Your feedback has been resolved" | `HR has marked your feedback "{title}" as resolved.` |

All notifications fire-and-forget via the existing `createNotification` helper.

---

## File Structure

| Path | Purpose |
|---|---|
| `app/(dashboard)/feedback/page.tsx` | Employee list + submit modal |
| `app/(dashboard)/feedback/[id]/page.tsx` | Employee thread view |
| `app/admin/feedback/page.tsx` | HR inbox table |
| `app/admin/feedback/[id]/page.tsx` | HR thread + status panel |
| `app/api/feedback/route.ts` | GET list, POST create |
| `app/api/feedback/[id]/route.ts` | GET thread |
| `app/api/feedback/[id]/replies/route.ts` | POST employee reply |
| `app/api/admin/feedback/route.ts` | HR GET all |
| `app/api/admin/feedback/[id]/route.ts` | HR GET thread + PATCH status |
| `app/api/admin/feedback/[id]/replies/route.ts` | HR POST reply |
| `prisma/migrations/YYYYMMDD_add_feedback/` | Schema migration |

---

## Out of Scope (v1)

- HR-initiated feedback requests (employee gets asked to submit)
- Pulse surveys / scheduled check-ins
- Feedback analytics / sentiment trends
- Feedback visible to managers (HR_ADMIN only in v1)
- File attachments
- Bulk status updates
