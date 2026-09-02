# Feed Account Mentions — Design

**Date:** 2026-09-02
**Status:** Approved, proceeding to implementation plan

## Problem

AGS One's Feed already supports `@`-mentioning an individual employee in a post (autocomplete
dropdown, stored inline as `@[Name|id]`, rendered as a clickable navy pill linking to
`/employees/[id]`). There is no way to reference which **client account** (e.g. Flyland, EMB —
Alliance Global Solutions serves multiple named client accounts) a post is about. Employees want
to tag a post with the relevant account the same casual way a hashtag works elsewhere.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Purpose | Purely a visual/contextual tag. No filtering, no notifications, no permission scoping tied to it. |
| Account list | Fixed, HR-admin managed — a real, small list of client accounts, not free text. |
| Trigger | `#`, separate from the existing `@` employee-mention trigger — not merged into one dropdown. |
| Scope | **Revised 2026-09-02** (see Revision Note below): both the Feed post composer and comments/replies. |
| Pill style | Neutral gray pill + `Building2` icon (already used elsewhere in the app for Departments) — deliberately not navy, so it reads as "an entity, not a person" without introducing a new color outside the app's 2-3-color design system. |
| Account fields | Name only — no description, no color, no logo. Mirrors `Department`'s shape exactly. |

## Revision note (2026-09-02, before implementation)

275 commits landed on `main` between the original design conversation and starting the plan —
including a real refactor of the `@`-mention system. The architecture section below was rewritten
against the current code, not the state it was originally designed against. Two things changed:

1. **Comments/replies now have full `@`-mention support** via a new, reusable
   `lib/hooks/useMentionInput.ts` hook (shared by both `CommentThread.tsx`'s top-level comment
   composer and its reply composer, each via its own hook instance) — this didn't exist at
   design time, and was the whole reason comments were originally deferred. With the expensive
   part (giving comments a mention composer at all) already done, extending `#`-accounts to
   comments is a comparable-cost addition to extending it to posts, not a separate large lift —
   so the scope decision above changed from posts-only to posts+comments.
2. **Mention rendering was extracted into a shared component**, `components/feed/PostMentionText.tsx`,
   used by both the post display and the comment/reply display — so fixing rendering once there
   covers everywhere `@[Name|id]` tokens appear, not just the Feed page.
3. The Feed **post composer** itself (`app/(dashboard)/feed/page.tsx`, backed by
   `lib/hooks/useFeedActions.ts`) was *not* migrated to the new hook — it still has its own older,
   inline `@`-mention implementation (`decodeMentions`/`encodeMentions`/`mentionQuery`/
   `insertMention` in `useFeedActions.ts`, its own inline dropdown JSX, no keyboard navigation).
   This PR does not migrate it — that's a separate, riskier change (touches working `@` behavior)
   and out of scope here. The new `#`-account hook is built fresh, mirroring `useMentionInput`'s
   shape, and wired into the post composer *alongside* its existing (untouched) `@` implementation.
4. `PostMentionText.tsx` currently renders `@`-mention pills in `text-blue-600 bg-blue-50` — drift
   from the design-system remediation that moved everything else to `navy-*`. Bundled into this
   PR as a 1-line fix since the account-mention work already touches this exact render branch.

## Data model

New `Account` model, deliberately as thin as `Department`:

```prisma
model Account {
  id        String   @id @default(uuid())
  name      String   @unique
  createdAt DateTime @default(now())
}
```

No relations to `User`, `SocialPost`, or anything else — an account mention is encoded directly
into the post's `content` string (see below), the same way employee mentions already are. No
join table needed.

## Admin management

New `/admin/accounts` page, mirroring `/admin/departments/page.tsx`'s existing pattern exactly:
list, add, rename, delete, `HR_ADMIN`-gated.

- `GET /api/admin/accounts` — list (admin only)
- `POST /api/admin/accounts` — create `{ name }` (admin only)
- `PATCH /api/admin/accounts/[id]` — rename (admin only)
- `DELETE /api/admin/accounts/[id]` — delete (admin only)
- `GET /api/accounts` — read-only list, any authenticated employee (feeds the Feed composer's
  `#` autocomplete — mirror whatever read-access pattern already sources the employee list for
  `@` autocomplete)

## New hook: `lib/hooks/useAccountTagInput.ts`

Mirrors `useMentionInput.ts`'s exact shape (`detect`/`select`/`prime`/`encode`/`reset`/`close`,
same `open`/`results`/`activeIndex` surface for `AccountTagDropdown` to consume), adapted for
accounts instead of employees:

- `TRIGGER = /#(?!\[)([^#\n]{0,40})$/` — same stop-at-newline/length-cap reasoning as the `@`
  trigger, mirrored for `#`.
- `AccountEntity = { id: string; name: string }` in place of `MentionEmployee`.
- `encode()` rewrites picked names to `#[Name|id]` tokens (mirrors `useMentionInput`'s `@[Name|id]`).
- `results` filters/slices the passed-in `accounts` list the same way `useMentionInput` filters
  `employees` (case-insensitive substring match, capped list length).
- One hook instance per textarea, exactly like `useMentionInput` — the post composer, the comment
  composer, and the reply composer each get their own instance.

**Not** built as a shared/generic `useTagInput<T>` — see Alternatives Considered below. Mirroring
`useMentionInput` file-for-file is the deliberate choice, not a shortcut.

## New component: `components/feed/AccountTagDropdown.tsx`

Mirrors `MentionDropdown.tsx` exactly (same `onMouseDown`-before-blur handling, same keyboard-nav
`activeIndex` wiring), with two differences: consumes an `AccountTagInput`-shaped prop instead of
`MentionInput`, and renders a `Building2` icon (`lucide-react`, already used elsewhere in the app
for Departments) in place of `<Avatar>` for each row.

## Wiring into the three composers

- **Post composer** (`app/(dashboard)/feed/page.tsx` / `lib/hooks/useFeedActions.ts`): add
  `useAccountTagInput(accounts)` alongside (not replacing) the existing inline `@`-mention state.
  Detect `#` on the same `onChange` handler that already detects `@`. Render
  `<AccountTagDropdown>` alongside the existing inline mention dropdown JSX. Call both `encode()`
  functions before submit (existing `encodeMentions` for `@`, the new hook's `encode()` for `#`)
  — order doesn't matter, the two token formats don't overlap.
- **Comment composer and reply composer** (`components/feed/CommentThread.tsx`): add a second
  `useAccountTagInput(accounts)` instance next to each existing `useMentionInput(employees)`
  instance (i.e. two new instances total — one for the top-level comment composer, one for the
  reply composer), following the exact same pattern already used for `@`. Render
  `<AccountTagDropdown>` next to each existing `<MentionDropdown>`.
- **Account roster fetch**: mirror however `employees` is currently fetched (inside
  `useFeedActions.ts`) and threaded down as a prop through `feed/page.tsx` → `CommentThread.tsx`
  — add a parallel `accounts` fetch (`GET /api/accounts`) and thread it the same way.

## Rendering (`components/feed/PostMentionText.tsx`)

This is the single shared component both the post display and the comment/reply display already
render through — fixing it once covers every surface. Extend the existing split-regex (currently
`/(@\[[^|]+\|[^\]]+\])/g`) to also capture `#[Name|id]` tokens, and take an `onMentionClick`-style
callback for accounts too (or none — see below). Two render branches:

- **Employee match** (`@[...]`) — clickable `<button>`, navigates via `onMentionClick`. **Also
  fix the color while touching this branch**: `text-blue-600 bg-blue-50` → `text-navy-600
  bg-navy-50` (the drift noted above).
- **Account match** (`#[...]`) — new: a **non-interactive** `<span>`, gray/muted pill background
  + a small `Building2` icon prefix + the account name. Not a `<button>`, no `onClick`, no route
  — there is no account detail page and none is needed, since this is purely a visual tag per the
  Decisions table above. Rendering it as a dead-looking button would be worse than rendering it
  as a plain styled label.

## Alternatives considered

**A shared "taggable entity" abstraction** (one generic mention encoder configured per entity
type, used by both `@` and `#`, and extensible to a third type later) was considered and
rejected for this pass. It would reduce some duplication between the `@` and `#` encode/decode
pairs, but for exactly two entity types with no shared behavior beyond "render a styled pill,"
it's abstraction the feature doesn't need yet. This codebase's own convention (per `CLAUDE.md`)
is to match existing patterns rather than build shared abstractions ahead of need — mirroring the
existing `@`-mention code is the more consistent, lower-risk choice, and is easy to unify later
if a third taggable type ever shows up.

**Free-text hashtags with no backing `Account` model** (any `#Word` becomes a styled pill,
no admin management, no real entity behind it) was considered and rejected — it directly
contradicts the "fixed list, HR-admin managed" decision above; it would let anyone tag any word,
not just a real account, and offers no autocomplete against a real, curated list.

## Out of scope (explicitly, not silently dropped)

- Migrating the post composer's existing `@`-mention implementation onto the newer
  `useMentionInput` hook — it keeps its current (older, no-keyboard-nav) implementation
  unchanged; only the new `#`-account hook is added alongside it.
- Filtering/searching Feed by account.
- Notifying anyone associated with an account when it's mentioned.
- Any per-account metadata beyond `name` (color, logo, description).
