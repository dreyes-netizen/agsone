# Shoutouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any employee publicly shoutout a colleague on the Feed, with a notification to the recipient and a visually distinct amber card.

**Architecture:** Four sequential tasks: (1) schema migration to add SHOUTOUT post type and recipient relation, (2) new public employees listing endpoint for the recipient picker, (3) extend the feed API to create/return shoutouts, (4) update the feed UI with a shoutout form, shoutout card, and Shoutouts filter tab.

**Tech Stack:** Prisma (schema + migration), Next.js App Router route handlers, Zod, React (client component), Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | **Modify** | Add `SHOUTOUT` to `PostType`; add `recipientId` + `recipient` to `SocialPost`; add `shoutoutsReceived` back-relation to `User` |
| `prisma/migrations/…` | **Auto-generated** | Created by `prisma migrate dev` |
| `app/api/employees/route.ts` | **Create** | `GET` — any authenticated user can fetch all employees (id, displayName, avatarUrl) for the recipient picker |
| `app/api/feed/route.ts` | **Modify** | Add `SHOUTOUT` Zod variant to POST; handle shoutout creation + notification; include `recipient` in GET |
| `app/(dashboard)/feed/page.tsx` | **Modify** | Add `recipient` to `FeedPost` type; add Shoutouts filter tab; add Give Shoutout button + inline form; add shoutout card render |

---

### Task 1: Schema — add SHOUTOUT post type and recipient relation

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `SHOUTOUT` to the `PostType` enum**

Find the `PostType` enum (currently around line 68):
```prisma
enum PostType {
  UPDATE
  ACHIEVEMENT
  CELEBRATION
  ANNOUNCEMENT
  POLL
}
```

Replace with:
```prisma
enum PostType {
  UPDATE
  ACHIEVEMENT
  CELEBRATION
  ANNOUNCEMENT
  POLL
  SHOUTOUT
}
```

- [ ] **Step 2: Add `recipientId` and `recipient` relation to `SocialPost`**

Find the `SocialPost` model. After the `isPinned` field add:
```prisma
  recipientId String?
```

After the existing `author` relation line add:
```prisma
  recipient   User?   @relation("ShoutoutsReceived", fields: [recipientId], references: [id])
```

- [ ] **Step 3: Add `shoutoutsReceived` back-relation to `User`**

Find the `User` model. After the `posts SocialPost[]` line add:
```prisma
  shoutoutsReceived SocialPost[] @relation("ShoutoutsReceived")
```

- [ ] **Step 4: Run the migration**

```bash
npx prisma migrate dev --name add_shoutout
```

Expected output: `✔  Generated Prisma Client` with no errors. A new migration folder appears under `prisma/migrations/`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SHOUTOUT post type and SocialPost recipient relation"
```

---

### Task 2: New `GET /api/employees` endpoint

**Files:**
- Create: `app/api/employees/route.ts`

This is a lightweight public employee list used by the shoutout recipient picker. Any authenticated user can call it. The admin endpoint at `/api/admin/employees` requires MANAGER/HR_ADMIN — this one does not.

- [ ] **Step 1: Create the route file**

```typescript
// app/api/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employees = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  return NextResponse.json({ data: employees });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/employees/route.ts
git commit -m "feat: add GET /api/employees for shoutout recipient picker"
```

---

### Task 3: Extend feed API for shoutouts

**Files:**
- Modify: `app/api/feed/route.ts`

Two changes: (a) include `recipient` in the GET query, (b) add a SHOUTOUT variant to the POST Zod schema and handle it.

- [ ] **Step 1: Add `recipient` to the GET include block**

Find the `include` block inside `prisma.socialPost.findMany` in the GET handler (around line 22):
```typescript
    include: {
      author: { select: { displayName: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      _count: { select: { comments: true } },
      pollOptions: { include: { _count: { select: { votes: true } } } },
    },
```

Replace with:
```typescript
    include: {
      author: { select: { displayName: true, avatarUrl: true } },
      recipient: { select: { id: true, displayName: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      _count: { select: { comments: true } },
      pollOptions: { include: { _count: { select: { votes: true } } } },
    },
```

- [ ] **Step 2: Add `createNotification` import**

At the top of the file, after the existing imports add:
```typescript
import { createNotification } from "@/lib/helpers/createNotification";
```

- [ ] **Step 3: Add SHOUTOUT variant to the Zod schema**

Find the `postSchema` discriminated union (around line 65):
```typescript
const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["UPDATE", "ACHIEVEMENT", "CELEBRATION", "ANNOUNCEMENT"]),
    content: z.string().min(1).max(1000),
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
  z.object({
    type: z.literal("POLL"),
    content: z.string().min(1).max(1000),
    options: z.array(z.string().min(1).max(200)).min(2).max(4),
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
]);
```

Replace with:
```typescript
const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["UPDATE", "ACHIEVEMENT", "CELEBRATION", "ANNOUNCEMENT"]),
    content: z.string().min(1).max(1000),
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
  z.object({
    type: z.literal("POLL"),
    content: z.string().min(1).max(1000),
    options: z.array(z.string().min(1).max(200)).min(2).max(4),
    imageUrls: z.array(z.string().url()).max(4).optional(),
  }),
  z.object({
    type: z.literal("SHOUTOUT"),
    content: z.string().min(1).max(500),
    recipientId: z.string().uuid(),
  }),
]);
```

- [ ] **Step 4: Add SHOUTOUT handler in the POST function**

Find the POST handler. After the `if (parsed.data.type === "POLL")` block and before the final generic `prisma.socialPost.create` call, insert:

```typescript
  if (parsed.data.type === "SHOUTOUT") {
    if (parsed.data.recipientId === user.id) {
      return NextResponse.json({ error: "Cannot shoutout yourself" }, { status: 400 });
    }
    const post = await prisma.socialPost.create({
      data: {
        authorId: user.id,
        content: parsed.data.content,
        type: "SHOUTOUT",
        imageUrls: [],
        recipientId: parsed.data.recipientId,
      },
      include: {
        author: { select: { displayName: true, avatarUrl: true } },
        recipient: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    createNotification({
      userId: parsed.data.recipientId,
      type: "SHOUTOUT_RECEIVED",
      title: `${user.displayName} gave you a shoutout!`,
      body: parsed.data.content.slice(0, 100),
    });
    return NextResponse.json({ data: { ...post, pollOptions: [], myVoteOptionId: null } }, { status: 201 });
  }
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/feed/route.ts
git commit -m "feat: add SHOUTOUT to feed API with recipient relation and notification"
```

---

### Task 4: Feed page — shoutout form, card, and filter tab

**Files:**
- Modify: `app/(dashboard)/feed/page.tsx`

Four sub-changes: (a) add `recipient` to the `FeedPost` type, (b) add an employee state + fetch for the picker, (c) add a Give Shoutout toggle button + inline form, (d) render shoutout cards with amber accent.

- [ ] **Step 1: Update the `FeedPost` type to include `recipient`**

Find the `FeedPost` type definition near the top of the file. It currently has `author: { displayName: string; avatarUrl: string | null }`. Add `recipient` after it:

```typescript
  author: { displayName: string; avatarUrl: string | null };
  recipient: { id: string; displayName: string; avatarUrl: string | null } | null;
```

- [ ] **Step 2: Add employee state + shoutout form state to the component**

Find the state declarations at the top of the main page component function. Add these alongside the existing state:

```typescript
const [showShoutoutForm, setShowShoutoutForm] = useState(false);
const [employees, setEmployees] = useState<{ id: string; displayName: string; avatarUrl: string | null }[]>([]);
const [shoutoutRecipientId, setShoutoutRecipientId] = useState("");
const [shoutoutContent, setShoutoutContent] = useState("");
const [shoutoutSubmitting, setShoutoutSubmitting] = useState(false);
```

- [ ] **Step 3: Fetch employees when shoutout form opens**

Find the existing `useEffect` that fetches feed data. Add a separate `useEffect`:

```typescript
useEffect(() => {
  if (!showShoutoutForm || employees.length > 0) return;
  apiFetch<{ data: { id: string; displayName: string; avatarUrl: string | null }[] }>("/api/employees")
    .then((res) => setEmployees(res.data))
    .catch(() => {});
}, [showShoutoutForm]);
```

- [ ] **Step 4: Add the `handleShoutoutSubmit` function**

Add this function inside the component, alongside the other handler functions:

```typescript
async function handleShoutoutSubmit() {
  if (!shoutoutRecipientId || !shoutoutContent.trim()) return;
  setShoutoutSubmitting(true);
  try {
    const res = await apiFetch<{ data: FeedPost }>("/api/feed", {
      method: "POST",
      body: JSON.stringify({ type: "SHOUTOUT", content: shoutoutContent.trim(), recipientId: shoutoutRecipientId }),
    });
    setPosts((prev) => [res.data, ...prev]);
    setShoutoutContent("");
    setShoutoutRecipientId("");
    setShowShoutoutForm(false);
  } catch {
    // silent — user sees no change
  } finally {
    setShoutoutSubmitting(false);
  }
}
```

- [ ] **Step 5: Add "Shoutouts" to the filter tab bar**

Find the existing filter tabs in the JSX. The tabs currently switch between "All" and post type filters using the `typeFilter` state. Add a Shoutouts tab:

```typescript
{["All", "Updates", "Shoutouts"].map((label) => {
  const value = label === "All" ? null : label === "Updates" ? "UPDATE" : "SHOUTOUT";
  return (
    <button
      key={label}
      onClick={() => { setTypeFilter(value); setPosts([]); setCursor(null); }}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        typeFilter === value
          ? "bg-white text-zinc-900 shadow-sm"
          : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
    </button>
  );
})}
```

Note: examine the existing filter tab code first and adapt to match its exact pattern — the above shows the shape but the existing variable names (e.g. `typeFilter`, `setTypeFilter`) may vary slightly.

- [ ] **Step 6: Add the Give Shoutout button and inline form**

Find the top of the feed page content area (near the existing post composer or top controls). Add the button + collapsible form:

```typescript
{/* Give Shoutout */}
<div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
  <div className="px-5 py-3 flex items-center justify-between">
    <span className="text-sm font-semibold text-zinc-700">Recognize a colleague</span>
    <button
      onClick={() => setShowShoutoutForm((v) => !v)}
      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
    >
      ✨ Give Shoutout
    </button>
  </div>

  {showShoutoutForm && (
    <div className="px-5 pb-4 border-t border-zinc-100 pt-3 space-y-3">
      <select
        value={shoutoutRecipientId}
        onChange={(e) => setShoutoutRecipientId(e.target.value)}
        className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
      >
        <option value="">Select a colleague…</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.displayName}</option>
        ))}
      </select>
      <textarea
        value={shoutoutContent}
        onChange={(e) => setShoutoutContent(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="What did they do that deserves recognition?"
        className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{shoutoutContent.length}/500</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowShoutoutForm(false); setShoutoutContent(""); setShoutoutRecipientId(""); }}
            className="text-sm text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleShoutoutSubmit}
            disabled={shoutoutSubmitting || !shoutoutRecipientId || !shoutoutContent.trim()}
            className="text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {shoutoutSubmitting ? "Sending…" : "Send Shoutout"}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 7: Render shoutout cards with amber treatment**

Find where feed posts are rendered (the `.map()` over `posts`). Add a shoutout-specific render path before (or instead of) the default card render:

```typescript
{post.type === "SHOUTOUT" && post.recipient && (
  <div key={post.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
    {/* Amber accent strip */}
    <div className="h-1.5 bg-gradient-to-r from-amber-400 to-yellow-300" />
    <div className="px-5 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {post.author.avatarUrl
            ? <img src={post.author.avatarUrl} className="w-6 h-6 rounded-full object-cover" />
            : <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">{post.author.displayName.charAt(0)}</div>
          }
          <span className="text-sm font-semibold text-zinc-800">{post.author.displayName}</span>
        </div>
        <span className="text-sm text-amber-600 font-medium">✨ gave a shoutout to</span>
        <div className="flex items-center gap-1.5">
          {post.recipient.avatarUrl
            ? <img src={post.recipient.avatarUrl} className="w-6 h-6 rounded-full object-cover" />
            : <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">{post.recipient.displayName.charAt(0)}</div>
          }
          <span className="text-sm font-semibold text-zinc-800">{post.recipient.displayName}</span>
        </div>
      </div>
      {/* Message */}
      <p className="text-sm text-zinc-700 leading-relaxed">{post.content}</p>
      {/* Timestamp */}
      <p className="text-xs text-zinc-400">{new Date(post.createdAt).toLocaleDateString()}</p>
      {/* Reactions — reuse existing ReactionBar component */}
      <ReactionBar
        postId={post.id}
        reactions={post.reactions}
        myReactions={post.myReactions}
        onReact={handleReact}
      />
    </div>
  </div>
)}
```

Note: `handleReact` is the existing reaction handler function in the file — use its actual name.

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type mismatches before committing.

- [ ] **Step 9: Manual smoke test**

Start the dev server (`npm run dev`) and verify:
- Feed page shows "Give Shoutout" button
- Clicking it opens the inline form with a colleague dropdown and textarea
- Selecting a colleague and typing a message enables "Send Shoutout"
- After submitting, a new amber-accented card appears at the top of the feed
- "Shoutouts" filter tab shows only shoutout cards
- Cannot send without selecting a recipient (button stays disabled)

- [ ] **Step 10: Commit**

```bash
git add "app/(dashboard)/feed/page.tsx"
git commit -m "feat: add shoutout form, amber card, and Shoutouts filter tab to feed"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| `SHOUTOUT` added to `PostType` enum | Task 1 |
| `recipientId` / `recipient` on `SocialPost` | Task 1 |
| `shoutoutsReceived` back-relation on `User` | Task 1 |
| `POST /api/feed` handles `type: SHOUTOUT` | Task 3 |
| Validates `recipientId` present, not self | Task 3 |
| Creates `Notification` for recipient | Task 3 |
| `GET /api/feed` includes `recipient` | Task 3 |
| Give Shoutout button top of feed | Task 4 |
| Inline form: recipient picker + message + submit | Task 4 |
| Amber/gold accent on shoutout card | Task 4 |
| Card header: sender gave shoutout to recipient | Task 4 |
| Reactions work on shoutout cards | Task 4 (reuses ReactionBar) |
| Shoutouts filter tab | Task 4 |
| In-app notification (no email) | Task 3 |
| 400 if sender = recipient | Task 3 |
| 400 if recipientId missing | Task 3 (Zod enforces uuid required) |
| Employee picker endpoint (any auth user) | Task 2 |
