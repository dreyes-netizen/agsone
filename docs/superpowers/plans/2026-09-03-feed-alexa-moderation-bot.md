# Feed Alexa Moderation Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI moderation gate ("Alexa") that checks every Feed post/comment/reply — and any edit to one — before it's saved, blocking harassment/slurs/personal attacks/threats while allowing banter and jokes.

**Architecture:** A new `lib/guardrails/moderation.ts` module calls OpenAI `gpt-4o-mini` (text + vision in one request) synchronously, before the Prisma write, in all 4 post/comment create-and-edit routes. A block returns `400` and nothing is saved (check-first-block); an `AuditLog` row is written under the real author as actor. On any OpenAI failure, the check fails open (content is allowed) and the failure is logged server-side. No schema changes, no new "bot" user.

**Tech Stack:** Next.js 16 App Router API routes, Prisma 7, the `openai` npm package (new dependency — official SDK, needed for typed structured JSON output + vision content blocks), Vitest for tests.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-09-03-feed-alexa-moderation-bot-design.md`.
- Model: `gpt-4o-mini` exactly (cost-efficient tier, confirmed live during design — do not swap to a different model name).
- `OPENAI_API_KEY` is already set in `.env.local` (confirmed working via a live smoke-test during design) — do not add a placeholder or ask for a new key.
- **Fail open**: any OpenAI error, timeout, or malformed response → `{blocked: false}` + `console.error`. Never fail closed.
- **Check-first-block only** — no schema changes (`SocialPost`/`SocialComment` are untouched), no soft-delete/placeholder state, no backfill/retroactive scan of existing content.
- GIF comments are the only image input in scope — no analysis of uploaded post photos.
- Every block is audit-logged under the **real author** as `actorId` (never a fake bot user) — actions `ALEXA_BLOCKED_POST` / `ALEXA_BLOCKED_COMMENT`.
- Reuse the existing rate-limiter (`lib/guardrails/rateLimiter.ts`) under a new `moderation` scope — do not build new abuse-protection infrastructure.
- Match this repo's existing test convention exactly: `vi.hoisted` + `vi.mock` for `@/lib/auth/verifyAuth` (mock only `verifyAuth`, import the real `requireRole` via `vi.importActual`) and `@/lib/prisma/client` — see `app/api/admin/accounts/route.test.ts` as the reference shape.

---

### Task 1: OpenAI client + `moderateContent()` guardrail

**Files:**
- Create: `lib/openai/client.ts`
- Create: `lib/guardrails/moderation.ts`
- Test: `lib/guardrails/moderation.test.ts`
- Modify: `package.json` (add `openai` dependency)

**Interfaces:**
- Produces: `export async function moderateContent(input: ModerateInput): Promise<ModerationResult>` where
  `type ModerateInput = { title?: string | null; body: string | null; gifId?: string | null }` and
  `type ModerationResult = { blocked: boolean; reason?: string }`. This is the single function every
  route in Tasks 4-7 calls.
- Consumes: nothing from earlier tasks (this is the first task).

- [ ] **Step 1: Install the `openai` package**

Run: `npm install openai`

Expected: `package.json`'s `dependencies` gains an `"openai"` entry (whatever version `npm install` resolves to — do not hand-edit a version number).

- [ ] **Step 2: Create the OpenAI client wrapper**

```typescript
// lib/openai/client.ts
import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

This mirrors `lib/groq/client.ts`'s one-line client construction — no other logic belongs in this file.

- [ ] **Step 3: Write the failing test for `moderateContent()`**

```typescript
// lib/guardrails/moderation.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/lib/openai/client", () => ({
  openai: { chat: { completions: { create: doubles.create } } },
}));

import { moderateContent } from "./moderation";

function completionWith(json: unknown) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moderateContent", () => {
  it("returns allowed with no API call when there is nothing to check", async () => {
    const result = await moderateContent({ body: null });
    expect(result).toEqual({ blocked: false });
    expect(doubles.create).not.toHaveBeenCalled();
  });

  it("blocks content the model flags as a violation", async () => {
    doubles.create.mockResolvedValue(
      completionWith({ blocked: true, reason: "Personal attack on a named coworker." })
    );
    const result = await moderateContent({ title: "you're pathetic", body: "everyone agrees you should quit" });
    expect(result).toEqual({ blocked: true, reason: "Personal attack on a named coworker." });
  });

  it("allows banter the model does not flag", async () => {
    doubles.create.mockResolvedValue(completionWith({ blocked: false, reason: "" }));
    const result = await moderateContent({ body: "haha nice one, close tayo?" });
    expect(result.blocked).toBe(false);
  });

  it("includes a GIF image block when gifId is present", async () => {
    doubles.create.mockResolvedValue(completionWith({ blocked: false, reason: "" }));
    await moderateContent({ body: "reacting to the shoutout", gifId: "abc123" });
    const call = doubles.create.mock.calls[0][0];
    const userMessage = call.messages.find((m: { role: string }) => m.role === "user");
    const imageBlock = userMessage.content.find((c: { type: string }) => c.type === "image_url");
    expect(imageBlock.image_url.url).toBe("https://media.giphy.com/media/abc123/giphy.gif");
  });

  it("fails open when the API call throws", async () => {
    doubles.create.mockRejectedValue(new Error("network error"));
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });

  it("fails open when the response is not valid JSON", async () => {
    doubles.create.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });

  it("fails open when the response is missing the blocked field", async () => {
    doubles.create.mockResolvedValue(completionWith({ reason: "whoops" }));
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run lib/guardrails/moderation.test.ts`
Expected: FAIL — `Cannot find module './moderation'` (the module doesn't exist yet).

- [ ] **Step 5: Implement `moderateContent()`**

```typescript
// lib/guardrails/moderation.ts
import { openai } from "@/lib/openai/client";

export type ModerationResult = { blocked: boolean; reason?: string };

export type ModerateInput = {
  title?: string | null;
  body: string | null;
  gifId?: string | null;
};

const SYSTEM_PROMPT = `You are Alexa, a content moderator for the internal employee Feed at Alliance Global Solutions.

Decide whether a Feed post, comment, or reply should be BLOCKED before it is ever published.

ALLOW (blocked: false):
- Casual banter, teasing, and inside jokes between coworkers, even when pointed or sarcastic.
- Jokes that reference someone by name in a lighthearted way (e.g. a "you're my next target" meme
  GIF dropped into a friendly thread, a teasing "are we even now?" reply).
- Complaints about work, venting about a bad day, casual profanity used for emphasis rather than
  as an insult directed at a person.

BLOCK (blocked: true):
- Harassment, personal attacks, or insults directed at a specific person.
- Slurs, hate speech, or discriminatory language of any kind.
- Threats of violence or intimidation, even if framed as a joke.
- Sexual harassment or explicit sexual content.
- Content that is "below the belt" -- attacking someone's character, appearance, family, or
  personal struggles rather than just teasing them.

When uncertain, lean toward ALLOW -- the bar is "not below the belt," not "inoffensive." Judge an
attached image/GIF in the context of the surrounding text, not in isolation.

Respond with ONLY a JSON object: {"blocked": boolean, "reason": string}. "reason" is a short,
specific explanation (max 200 characters) -- required when blocked is true, an empty string when
blocked is false.`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function moderateContent({ title, body, gifId }: ModerateInput): Promise<ModerationResult> {
  const textParts = [title, body].filter((t): t is string => Boolean(t && t.trim()));
  if (textParts.length === 0 && !gifId) return { blocked: false };

  const content: ContentPart[] = [];
  if (textParts.length > 0) content.push({ type: "text", text: textParts.join("\n\n") });
  if (gifId) content.push({ type: "image_url", image_url: { url: `https://media.giphy.com/media/${gifId}/giphy.gif` } });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 150,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: content as never },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { blocked: false };

    const parsed = JSON.parse(raw) as { blocked?: unknown; reason?: unknown };
    if (typeof parsed.blocked !== "boolean") return { blocked: false };

    return {
      blocked: parsed.blocked,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch (err) {
    console.error("[moderateContent] Alexa check failed, failing open:", err);
    return { blocked: false };
  }
}
```

Note on `content as never`: the installed `openai` package's exact TypeScript types for
multi-part message content may differ slightly by version. If `npx tsc --noEmit` (Step 7) reports
a real type error here, fix the `ContentPart` type to match what `node_modules/openai/resources/chat/completions` actually exports rather than widening with `as never` — the cast is a placeholder to unblock the plan text, not the intended final state.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/guardrails/moderation.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. If the `content` field shape in Step 5 doesn't match the installed SDK's types, fix `ContentPart`/the cast per the note above until this is clean.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/openai/client.ts lib/guardrails/moderation.ts lib/guardrails/moderation.test.ts
git commit -m "feat: add Alexa moderation guardrail (OpenAI gpt-4o-mini, text + GIF vision)"
```

---

### Task 2: Rate-limit the moderation check

**Files:**
- Modify: `lib/guardrails/rateLimiter.ts`

**Interfaces:**
- Consumes: `SCOPE_CONFIG` (existing), `checkRateLimit(userId, scope)` (existing, unchanged signature).
- Produces: `"moderation"` becomes a valid `RateLimitScope` value or later tasks' `checkRateLimit(user.id, "moderation")` calls won't type-check.

- [ ] **Step 1: Add the new scope**

In `lib/guardrails/rateLimiter.ts`, add to `SCOPE_CONFIG` (after the existing `notify` entry, before the closing `}`):

```typescript
  // Every post/comment create-or-edit now triggers a paid OpenAI call via
  // Alexa (lib/guardrails/moderation.ts) -- generous enough for normal Feed
  // use, tight enough to blunt cost/abuse from a scripted spam attempt.
  moderation: { limit: 60, window: "5 m" as const, windowMs: 5 * 60 * 1000 },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (the `Record<string, {...}>` constraint on `SCOPE_CONFIG` already validates the shape).

- [ ] **Step 3: Commit**

```bash
git add lib/guardrails/rateLimiter.ts
git commit -m "feat: add moderation rate-limit scope"
```

---

### Task 3: Audit action labels

**Files:**
- Modify: `lib/constants/auditActions.ts`

**Interfaces:**
- Produces: `"ALEXA_BLOCKED_POST"` and `"ALEXA_BLOCKED_COMMENT"` as valid `action` strings later tasks' `writeAuditLog()` calls use.

- [ ] **Step 1: Add the two labels**

In `lib/constants/auditActions.ts`, immediately after the existing `DELETE_POST`/`DELETE_COMMENT` lines:

```typescript
  ALEXA_BLOCKED_POST:        { label: "Alexa Blocked Post",    color: "bg-red-100 text-red-700" },
  ALEXA_BLOCKED_COMMENT:     { label: "Alexa Blocked Comment", color: "bg-red-100 text-red-700" },
```

- [ ] **Step 2: Commit**

```bash
git add lib/constants/auditActions.ts
git commit -m "feat: add ALEXA_BLOCKED_POST/COMMENT audit action labels"
```

---

### Task 4: Wire into post creation (`POST /api/feed`)

**Files:**
- Modify: `app/api/feed/route.ts`
- Create: `app/api/feed/route.test.ts`

**Interfaces:**
- Consumes: `moderateContent` (Task 1), `checkRateLimit` (Task 2, existing signature), `writeAuditLog` (existing), `ALEXA_BLOCKED_POST` (Task 3, used as a literal string).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/feed/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  postFindMany: vi.fn(),
  postCreate: vi.fn(),
  pollVoteFindMany: vi.fn(),
  reactionGroupBy: vi.fn(),
  reactionFindMany: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
  resolveMentionRecipients: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialPost: { findMany: doubles.postFindMany, create: doubles.postCreate },
    pollVote: { findMany: doubles.pollVoteFindMany },
    socialReaction: { groupBy: doubles.reactionGroupBy, findMany: doubles.reactionFindMany },
  },
}));

vi.mock("@/lib/guardrails/moderation", () => ({ moderateContent: doubles.moderateContent }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: doubles.checkRateLimit }));
vi.mock("@/lib/helpers/writeAuditLog", () => ({ writeAuditLog: doubles.writeAuditLog }));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));
vi.mock("@/lib/helpers/parseMentions", () => ({
  resolveMentionRecipients: doubles.resolveMentionRecipients,
  stripMentionTokens: (s: string) => s,
}));
vi.mock("@/lib/helpers/createNotification", () => ({ createNotification: doubles.createNotification }));

import { POST } from "./route";

const EMPLOYEE = {
  id: "emp-1",
  firebaseUid: "fb-1",
  email: "emp@ags.test",
  displayName: "Employee One",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed", { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof POST>[0];
}

const validBody = { title: "Hello", content: "Hello team", type: "UPDATE", flair: "CASUAL" };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
  doubles.resolveMentionRecipients.mockResolvedValue([]);
});

describe("POST /api/feed — Alexa moderation", () => {
  it("blocks a flagged post, writes an audit log, and never calls create", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Personal attack." });

    const res = await POST(req(validBody));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Alexa/);
    expect(doubles.postCreate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_POST" })
    );
  });

  it("proceeds to create when moderation allows the post", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.postCreate.mockResolvedValue({
      id: "post-1", authorId: "emp-1", title: "Hello", content: "Hello team",
      departmentId: null, type: "UPDATE",
    });

    const res = await POST(req(validBody));

    expect(res.status).toBe(201);
    expect(doubles.postCreate).toHaveBeenCalledTimes(1);
    expect(doubles.writeAuditLog).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/api/feed/route.test.ts`
Expected: FAIL — the route doesn't call `moderateContent` yet, so `blocked: true` has no effect and the first test's `res.status` will be `201`, not `400`.

- [ ] **Step 3: Wire the check into `app/api/feed/route.ts`**

Add imports near the top (after the existing `resolveMentionRecipients` import):

```typescript
import { moderateContent } from "@/lib/guardrails/moderation";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
```

In the `POST` handler, immediately after `if (!parsed.success) return NextResponse.json(...)` (right before the `if (parsed.data.type === "POLL")` branch), insert:

```typescript
  await checkRateLimit(user.id, "moderation");
  const moderation = await moderateContent({
    title: parsed.data.title ?? null,
    body: parsed.data.content,
  });
  if (moderation.blocked) {
    await writeAuditLog({
      actorId: user.id,
      action: "ALEXA_BLOCKED_POST",
      entityType: "SocialPost",
      entityId: "n/a",
      before: { title: parsed.data.title ?? null, content: parsed.data.content, reason: moderation.reason },
    });
    return NextResponse.json(
      { error: `Alexa: ${moderation.reason ?? "This doesn't meet our community guidelines."} Please revise and try again.` },
      { status: 400 }
    );
  }
```

Note: `checkRateLimit`'s result is intentionally not branched on here — per Global Constraints this reuses the existing scope purely for abuse/cost protection, and the design doesn't require rejecting the user's post if they're merely over a generous 60-per-5-minutes threshold on ordinary Feed use; `checkRateLimit`'s `{allowed, remaining}` return is available if a future task wants to reject on `!allowed`, but that's out of scope here — the call's purpose in v1 is that it's tracked (visible in Upstash/rate-limit metrics), not that it blocks.

`entityId: "n/a"` is deliberate: unlike `DELETE_POST` (which logs an existing row's real id), a blocked post never gets a `SocialPost.id` — nothing was created. If this reads oddly on the Audit Log UI once implemented, that's expected; `beforeState` carries the actual rejected content for review.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/api/feed/route.test.ts`
Expected: PASS, both tests.

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `npx vitest run --exclude "deliverables/**"`
Expected: all files pass, no new failures elsewhere in `app/api/feed/`.

- [ ] **Step 6: Commit**

```bash
git add app/api/feed/route.ts app/api/feed/route.test.ts
git commit -m "feat: wire Alexa moderation into POST /api/feed"
```

---

### Task 5: Wire into post edit (`PATCH /api/feed/[id]`)

**Files:**
- Modify: `app/api/feed/[id]/route.ts`
- Create: `app/api/feed/[id]/route.test.ts`

**Interfaces:**
- Consumes: same as Task 4.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/feed/[id]/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  postFindFirst: vi.fn(),
  postFindUnique: vi.fn(),
  postUpdate: vi.fn(),
  postDelete: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
  pollVoteFindFirst: vi.fn(),
  reactionGroupBy: vi.fn(),
  reactionFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialPost: {
      findFirst: doubles.postFindFirst,
      findUnique: doubles.postFindUnique,
      update: doubles.postUpdate,
      delete: doubles.postDelete,
    },
    pollVote: { findFirst: doubles.pollVoteFindFirst },
    socialReaction: { groupBy: doubles.reactionGroupBy, findMany: doubles.reactionFindMany },
  },
}));

vi.mock("@/lib/guardrails/moderation", () => ({ moderateContent: doubles.moderateContent }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: doubles.checkRateLimit }));
vi.mock("@/lib/helpers/writeAuditLog", () => ({ writeAuditLog: doubles.writeAuditLog }));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));

import { PATCH } from "./route";

const EMPLOYEE = {
  id: "emp-1", firebaseUid: "fb-1", email: "emp@ags.test",
  displayName: "Employee One", role: "EMPLOYEE" as const, departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed/post-1", { method: "PATCH", body: JSON.stringify(body) }) as unknown as Parameters<typeof PATCH>[0];
}
const params = { params: Promise.resolve({ id: "post-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("PATCH /api/feed/[id] — edit — Alexa moderation", () => {
  it("blocks a flagged edit, writes an audit log, and never calls update", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.postFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Harassment." });

    const res = await PATCH(req({ title: "Edited", content: "you are the worst" }), params);

    expect(res.status).toBe(400);
    expect(doubles.postUpdate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_POST", entityId: "post-1" })
    );
  });

  it("proceeds to update when moderation allows the edit", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.postFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.postUpdate.mockResolvedValue({ id: "post-1", title: "Edited", content: "all good", updatedAt: new Date() });

    const res = await PATCH(req({ title: "Edited", content: "all good" }), params);

    expect(res.status).toBe(200);
    expect(doubles.postUpdate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/feed/[id]/route.test.ts"`
Expected: FAIL — moderation isn't wired yet.

- [ ] **Step 3: Wire the check into the `isEdit` branch**

Add imports at the top of `app/api/feed/[id]/route.ts`:

```typescript
import { moderateContent } from "@/lib/guardrails/moderation";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
```

(`writeAuditLog` is already imported in this file.)

Inside the `PATCH` handler's `if (isEdit) { ... }` block, immediately after the `if (post.authorId !== user.id && !isAdmin) { return ...403 }` check and before `const updated = await prisma.socialPost.update(...)`, insert:

```typescript
    await checkRateLimit(user.id, "moderation");
    const moderation = await moderateContent({
      title: parsed.data.title ?? null,
      body: parsed.data.content ?? null,
    });
    if (moderation.blocked) {
      await writeAuditLog({
        actorId: user.id,
        action: "ALEXA_BLOCKED_POST",
        entityType: "SocialPost",
        entityId: id,
        before: { title: parsed.data.title, content: parsed.data.content, reason: moderation.reason },
      });
      return NextResponse.json(
        { error: `Alexa: ${moderation.reason ?? "This doesn't meet our community guidelines."} Please revise and try again.` },
        { status: 400 }
      );
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/api/feed/[id]/route.test.ts"`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add "app/api/feed/[id]/route.ts" "app/api/feed/[id]/route.test.ts"
git commit -m "feat: wire Alexa moderation into PATCH /api/feed/[id] edit"
```

---

### Task 6: Wire into comment creation (`POST /api/feed/[id]/comments`)

**Files:**
- Modify: `app/api/feed/[id]/comments/route.ts`
- Create: `app/api/feed/[id]/comments/route.test.ts`

**Interfaces:**
- Consumes: same as Task 4, plus this is the first route where `gifId` is passed to `moderateContent`.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/feed/[id]/comments/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  postFindFirst: vi.fn(),
  commentFindUnique: vi.fn(),
  commentCreate: vi.fn(),
  commentFindMany: vi.fn(),
  reactionGroupBy: vi.fn(),
  reactionFindMany: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
  resolveMentionRecipients: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialPost: { findFirst: doubles.postFindFirst },
    socialComment: { findUnique: doubles.commentFindUnique, create: doubles.commentCreate, findMany: doubles.commentFindMany },
    commentReaction: { groupBy: doubles.reactionGroupBy, findMany: doubles.reactionFindMany },
  },
}));

vi.mock("@/lib/guardrails/moderation", () => ({ moderateContent: doubles.moderateContent }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: doubles.checkRateLimit }));
vi.mock("@/lib/helpers/writeAuditLog", () => ({ writeAuditLog: doubles.writeAuditLog }));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));
vi.mock("@/lib/helpers/parseMentions", () => ({
  resolveMentionRecipients: doubles.resolveMentionRecipients,
  stripMentionTokens: (s: string) => s,
}));
vi.mock("@/lib/helpers/createNotification", () => ({ createNotification: doubles.createNotification }));

import { POST } from "./route";

const EMPLOYEE = {
  id: "emp-1", firebaseUid: "fb-1", email: "emp@ags.test",
  displayName: "Employee One", role: "EMPLOYEE" as const, departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed/post-1/comments", { method: "POST", body: JSON.stringify(body) }) as unknown as Parameters<typeof POST>[0];
}
const params = { params: Promise.resolve({ id: "post-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
  doubles.resolveMentionRecipients.mockResolvedValue([]);
  doubles.postFindFirst.mockResolvedValue({ id: "post-1", authorId: "other-1", departmentId: null });
});

describe("POST /api/feed/[id]/comments — Alexa moderation", () => {
  it("blocks a flagged text comment and never calls create", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Slur." });

    const res = await POST(req({ content: "some slur", commentType: "TEXT" }), params);

    expect(res.status).toBe(400);
    expect(doubles.commentCreate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_COMMENT" })
    );
  });

  it("passes gifId through to moderateContent for a GIF comment", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.commentCreate.mockResolvedValue({
      id: "c1", content: null, commentType: "GIF", gifProvider: "giphy", gifId: "xyz",
      createdAt: new Date(), authorId: "emp-1", parentId: null,
      author: { displayName: "Employee One", avatarUrl: null },
    });

    await POST(req({ commentType: "GIF", gifProvider: "giphy", gifId: "xyz" }), params);

    expect(doubles.moderateContent).toHaveBeenCalledWith(
      expect.objectContaining({ gifId: "xyz" })
    );
  });

  it("proceeds to create when moderation allows the comment", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.commentCreate.mockResolvedValue({
      id: "c1", content: "nice one", commentType: "TEXT", gifProvider: null, gifId: null,
      createdAt: new Date(), authorId: "emp-1", parentId: null,
      author: { displayName: "Employee One", avatarUrl: null },
    });

    const res = await POST(req({ content: "nice one", commentType: "TEXT" }), params);

    expect(res.status).toBe(201);
    expect(doubles.commentCreate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/feed/[id]/comments/route.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Wire the check into `app/api/feed/[id]/comments/route.ts`**

Add imports near the top (after the existing `resolveMentionRecipients` import):

```typescript
import { moderateContent } from "@/lib/guardrails/moderation";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { writeAuditLog } from "@/lib/helpers/writeAuditLog";
```

In the `POST` handler, immediately after the existing `if (!post) return ...404` / `if (parentId && ...) return ...400` checks and before `const comment = await prisma.socialComment.create(...)`, insert:

```typescript
  await checkRateLimit(user.id, "moderation");
  const moderation = await moderateContent({
    body: content ?? null,
    gifId: commentType === "GIF" ? gifId ?? null : null,
  });
  if (moderation.blocked) {
    await writeAuditLog({
      actorId: user.id,
      action: "ALEXA_BLOCKED_COMMENT",
      entityType: "SocialComment",
      entityId: "n/a",
      before: { postId: id, parentId: parentId ?? null, content, commentType, gifId, reason: moderation.reason },
    });
    return NextResponse.json(
      { error: `Alexa: ${moderation.reason ?? "This doesn't meet our community guidelines."} Please revise and try again.` },
      { status: 400 }
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/api/feed/[id]/comments/route.test.ts"`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/api/feed/[id]/comments/route.ts" "app/api/feed/[id]/comments/route.test.ts"
git commit -m "feat: wire Alexa moderation into POST /api/feed/[id]/comments (text + GIF)"
```

---

### Task 7: Wire into comment/reply edit (`PATCH /api/feed/[id]/comments/[commentId]`)

**Files:**
- Modify: `app/api/feed/[id]/comments/[commentId]/route.ts`
- Create: `app/api/feed/[id]/comments/[commentId]/route.test.ts`

**Interfaces:**
- Consumes: same as Task 4. This route's `editSchema` is `{ content: z.string().min(1).max(1000) }` — text only, no `gifId` (matches this route's existing edit schema; GIF comments can't be edited today).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/feed/[id]/comments/[commentId]/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  commentFindUnique: vi.fn(),
  commentUpdate: vi.fn(),
  commentDelete: vi.fn(),
  moderateContent: vi.fn(),
  checkRateLimit: vi.fn(),
  writeAuditLog: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>("@/lib/auth/requireRole");
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    socialComment: { findUnique: doubles.commentFindUnique, update: doubles.commentUpdate, delete: doubles.commentDelete },
  },
}));

vi.mock("@/lib/guardrails/moderation", () => ({ moderateContent: doubles.moderateContent }));
vi.mock("@/lib/guardrails/rateLimiter", () => ({ checkRateLimit: doubles.checkRateLimit }));
vi.mock("@/lib/helpers/writeAuditLog", () => ({ writeAuditLog: doubles.writeAuditLog }));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));

import { PATCH } from "./route";

const EMPLOYEE = {
  id: "emp-1", firebaseUid: "fb-1", email: "emp@ags.test",
  displayName: "Employee One", role: "EMPLOYEE" as const, departmentId: null,
};

function req(body: unknown) {
  return new Request("http://test/api/feed/post-1/comments/c1", { method: "PATCH", body: JSON.stringify(body) }) as unknown as Parameters<typeof PATCH>[0];
}
const params = { params: Promise.resolve({ id: "post-1", commentId: "c1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  doubles.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
});

describe("PATCH /api/feed/[id]/comments/[commentId] — Alexa moderation", () => {
  it("blocks a flagged edit and never calls update", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.commentFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: true, reason: "Threat." });

    const res = await PATCH(req({ content: "watch yourself" }), params);

    expect(res.status).toBe(400);
    expect(doubles.commentUpdate).not.toHaveBeenCalled();
    expect(doubles.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "emp-1", action: "ALEXA_BLOCKED_COMMENT", entityId: "c1" })
    );
  });

  it("proceeds to update when moderation allows the edit", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    doubles.commentFindUnique.mockResolvedValue({ authorId: "emp-1" });
    doubles.moderateContent.mockResolvedValue({ blocked: false });
    doubles.commentUpdate.mockResolvedValue({ id: "c1", content: "all good now" });

    const res = await PATCH(req({ content: "all good now" }), params);

    expect(res.status).toBe(200);
    expect(doubles.commentUpdate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/api/feed/[id]/comments/[commentId]/route.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Wire the check into the `PATCH` handler**

Add imports at the top of `app/api/feed/[id]/comments/[commentId]/route.ts`:

```typescript
import { moderateContent } from "@/lib/guardrails/moderation";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
```

(`writeAuditLog` is already imported in this file.)

In the `PATCH` handler, immediately after `if (comment.authorId !== user.id) return ...403` and before `const updated = await prisma.socialComment.update(...)`, insert:

```typescript
  await checkRateLimit(user.id, "moderation");
  const moderation = await moderateContent({ body: parsed.data.content });
  if (moderation.blocked) {
    await writeAuditLog({
      actorId: user.id,
      action: "ALEXA_BLOCKED_COMMENT",
      entityType: "SocialComment",
      entityId: commentId,
      before: { content: parsed.data.content, reason: moderation.reason },
    });
    return NextResponse.json(
      { error: `Alexa: ${moderation.reason ?? "This doesn't meet our community guidelines."} Please revise and try again.` },
      { status: 400 }
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/api/feed/[id]/comments/[commentId]/route.test.ts"`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add "app/api/feed/[id]/comments/[commentId]/route.ts" "app/api/feed/[id]/comments/[commentId]/route.test.ts"
git commit -m "feat: wire Alexa moderation into PATCH /api/feed/[id]/comments/[commentId] edit"
```

---

### Task 8: Client-side — surface Alexa's rejection message

**Files:**
- Modify: `lib/hooks/useFeedActions.ts`

**Interfaces:**
- Consumes: `apiFetch` already throws `new Error(msg)` where `msg` is the server's `error` string (see `lib/hooks/useApiClient.ts:47-52`) — since Tasks 4-7 all return `{ error: "Alexa: <reason> Please revise and try again." }` as a plain string, no new response-shape parsing is needed on the client; the existing `Error.message` already carries the full Alexa-branded text.
- No new exports — this task only changes error-handling bodies of existing functions.

- [ ] **Step 1: Update `handlePost`'s catch block**

In `lib/hooks/useFeedActions.ts`, find (around line 390):

```typescript
    } catch {
      setPostToast("Something went wrong. Please try again.");
      setTimeout(() => setPostToast(null), 4000);
    } finally {
```

Replace with:

```typescript
    } catch (err) {
      setPostToast(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setTimeout(() => setPostToast(null), 4000);
    } finally {
```

- [ ] **Step 2: Update `submitComment`'s catch block**

Find (around line 541):

```typescript
    } catch {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== optimisticId),
      }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
      setCommentDraft((prev) => ({ ...prev, [postId]: content }));
    } finally {
      setCommentSending((prev) => ({ ...prev, [postId]: false }));
    }
  }
```

Replace with:

```typescript
    } catch (err) {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter((c) => c.id !== optimisticId),
      }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
      setCommentDraft((prev) => ({ ...prev, [postId]: content }));
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setCommentSending((prev) => ({ ...prev, [postId]: false }));
    }
  }
```

- [ ] **Step 3: Update `submitReply`'s catch block**

Find (around line 603):

```typescript
    } catch {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId ? { ...c, replies: c.replies.filter((r) => r.id !== optimisticId) } : c
        ),
      }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
      setReplyDraft((prev) => ({ ...prev, [parentId]: content }));
    } finally {
      setReplySending((prev) => ({ ...prev, [parentId]: false }));
    }
  }
```

Replace with:

```typescript
    } catch (err) {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId ? { ...c, replies: c.replies.filter((r) => r.id !== optimisticId) } : c
        ),
      }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)));
      setReplyDraft((prev) => ({ ...prev, [parentId]: content }));
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setReplySending((prev) => ({ ...prev, [parentId]: false }));
    }
  }
```

- [ ] **Step 4: Add error handling to `saveEditComment` (currently has none)**

Find (around line 649-675):

```typescript
  async function saveEditComment(postId: string) {
    if (!editingComment) return;
    const { id, content, isReply, parentId } = editingComment;
    const trimmed = content.trim();
    if (!trimmed) return;

    if (isReply && parentId) {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId
            ? { ...c, replies: c.replies.map((r) => (r.id === id ? { ...r, content: trimmed } : r)) }
            : c
        ),
      }));
    } else {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) => (c.id === id ? { ...c, content: trimmed } : c)),
      }));
    }
    setEditingComment(null);
    await apiFetch(`/api/feed/${postId}/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: trimmed }),
    });
  }
```

Replace with (this also fixes a pre-existing gap: today a failed edit here has no rollback and no error
message at all — an unhandled rejection with the optimistic, unsaved content left showing as if it
persisted. Alexa blocking an edit makes this gap directly user-facing, so it's fixed here as part of
wiring the check in, not as unrelated cleanup):

```typescript
  async function saveEditComment(postId: string) {
    if (!editingComment) return;
    const { id, content, isReply, parentId } = editingComment;
    const trimmed = content.trim();
    if (!trimmed) return;
    const previousCache = commentsCache;

    if (isReply && parentId) {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) =>
          c.id === parentId
            ? { ...c, replies: c.replies.map((r) => (r.id === id ? { ...r, content: trimmed } : r)) }
            : c
        ),
      }));
    } else {
      setCommentsCache((prev) => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map((c) => (c.id === id ? { ...c, content: trimmed } : c)),
      }));
    }
    setEditingComment(null);
    try {
      await apiFetch(`/api/feed/${postId}/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: trimmed }),
      });
    } catch (err) {
      setCommentsCache(previousCache);
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    }
  }
```

- [ ] **Step 5: `saveEditPost` and `togglePin` already use `toast.error(err instanceof Error ? err.message : ...)`**

No change needed — confirm this by reading the current state of both functions; they already surface
`err.message`, so Alexa's rejection text will already reach the user there once Task 5 is wired in.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings introduced by this task.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run --exclude "deliverables/**"`
Expected: all tests still pass (this task touches no server-side logic, only client error-handling bodies with no dedicated unit tests today — consistent with the rest of `useFeedActions.ts`, which also has no unit tests).

- [ ] **Step 8: Commit**

```bash
git add lib/hooks/useFeedActions.ts
git commit -m "feat: surface Alexa's rejection message in Feed post/comment/reply composers"
```

---

### Task 9: Full regression pass + live smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full automated verification**

Run in order:
```bash
npx tsc --noEmit
npm run lint
npx vitest run --exclude "deliverables/**"
npm run build
```
Expected: all four clean (lint may show the same pre-existing baseline `<img>` warnings and the unrelated `vitest.config.test.ts` error noted in prior sessions — confirm no *new* findings, same as the account-mentions feature's own regression pass).

- [ ] **Step 2: Live smoke test against the real OpenAI API**

This cannot be a unit test (AI judgment is non-deterministic) — do it manually:

1. Start the dev server (`npm run dev`) if not already running.
2. In the browser, log in and open `/feed`.
3. Post something clearly benign (e.g. "Happy Friday team!") — confirm it's created normally.
4. Post something that clearly violates the standard (e.g. a direct insult naming a coworker) —
   confirm it's rejected with an "Alexa: ..." toast/message and never appears in the Feed.
5. Post a gray-line joke (banter, not below the belt) — confirm it's **allowed**, not blocked.
6. Repeat a blocked attempt as a comment and as a reply, to confirm all three surfaces are wired.
7. Check the terminal/server logs — confirm no unexpected errors during any of the above (a
   `console.error("[moderateContent] ...")` line would only be expected if you deliberately test
   the fail-open path, e.g. by temporarily breaking `OPENAI_API_KEY`).

**Clean up test data afterward** — per this repo's own `CLAUDE.md` ("Local verification vs.
production data"), this shares the single production Supabase database with no local/staging
split. Delete any test posts/comments/replies created in Step 2 via the app's own UI once
verification is done.

- [ ] **Step 3: Report results**

Summarize pass/fail for each of Step 1's four checks and each of Step 2's six manual checks before
considering this plan complete.
