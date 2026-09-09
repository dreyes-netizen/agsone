# Feed Clickable Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A URL in a Feed post/comment/reply renders as an actual clickable link (bare URL auto-linkified, or a custom short label via a new composer control), and any validation error on the 33 routes sharing the `zod.flatten()` convention shows its real reason to the user instead of a generic `"Request failed (400)"`.

**Architecture:** Extend `PostMentionText.tsx`'s existing token-splitting renderer (already shared by post bodies, comments, and replies) with two more token patterns — `[label](https://...)` and bare `https://...` — both rendered as real `<a>` tags. Add a new "Add Link" control to the main post composer that inserts the stored token form at the cursor, mirroring the existing `insertAccount`/mention-insert pattern. Separately, teach `apiFetch`/`streamFetch` to extract a readable message from a zod `flatten()`-shaped error instead of discarding it.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind v4 (existing `navy` color tokens only), Vitest (Node environment, no jsdom/RTL — this repo tests hook/render logic via `renderToStaticMarkup` from `react-dom/server` and by unit-testing pure functions extracted to module scope).

## Global Constraints

- No new npm dependencies.
- No schema changes, no new API routes.
- A string can only ever become a rendered `href` if it has a literal `https://` or `http://` prefix — this is what rules out a `javascript:`/`data:` XSS vector; do not relax this.
- Reuse the existing `text-navy-600` / `text-navy-800` Tailwind tokens for link styling — no new colors introduced (`PostMentionText.tsx` already uses `text-navy-600` for mention tokens).
- The new "Add Link" composer control is added to the **main post composer only** (`app/(dashboard)/feed/page.tsx`) — not to comments or replies. Comments/replies still *render* any link correctly, via the shared `PostMentionText` change; they just don't get the new insert-link button.
- Edit mode (`components/feed/PostBody.tsx`) gets no new UI — a `[label](url)` already in content shows as literal, hand-editable text there, unchanged.
- Match this repo's existing test convention for this kind of file exactly: `.test.ts` (not `.tsx`), Vitest, `renderToStaticMarkup`/`createElement` from `react`/`react-dom/server` for render-output assertions (see `components/minigames/solo/SoloGameGrid.test.ts`), and plain unit tests for pure functions extracted to module scope (see `hasAccountTagTrigger` in `lib/hooks/useAccountTagInput.ts` / `.test.ts`).
- Follow this repo's TDD command: `npx vitest run <file>` for a single file, `npm test` for the full suite.

---

### Task 1: Fix opaque validation-error messages in `apiFetch`/`streamFetch`

**Files:**
- Modify: `lib/hooks/useApiClient.ts`
- Test: `lib/hooks/useApiClient.test.ts` (new)

**Interfaces:**
- Produces: `extractErrorMessage(err: unknown, status: number): string` — exported from `lib/hooks/useApiClient.ts`, used internally by both `apiFetch` and `streamFetch`. No other task depends on this.

- [ ] **Step 1: Write the failing test**

Create `lib/hooks/useApiClient.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "./useApiClient";

describe("extractErrorMessage", () => {
  it("returns a plain string error as-is", () => {
    expect(extractErrorMessage({ error: "Alexa: This doesn't meet our community guidelines." }, 400))
      .toBe("Alexa: This doesn't meet our community guidelines.");
  });

  it("extracts the first fieldErrors message from a zod flatten() shape", () => {
    const err = { error: { formErrors: [], fieldErrors: { title: ["Title is required"] } } };
    expect(extractErrorMessage(err, 400)).toBe("Title is required");
  });

  it("falls back to formErrors when fieldErrors is empty", () => {
    const err = { error: { formErrors: ["Something is wrong"], fieldErrors: {} } };
    expect(extractErrorMessage(err, 400)).toBe("Something is wrong");
  });

  it("uses the message field when error is missing entirely", () => {
    expect(extractErrorMessage({ message: "custom failure" }, 500)).toBe("custom failure");
  });

  it("falls back to a generic message for an unrecognized error shape", () => {
    expect(extractErrorMessage({}, 400)).toBe("Request failed (400)");
  });

  it("falls back to a generic message when fieldErrors and formErrors are both empty", () => {
    const err = { error: { formErrors: [], fieldErrors: {} } };
    expect(extractErrorMessage(err, 422)).toBe("Request failed (422)");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/hooks/useApiClient.test.ts`
Expected: FAIL — `extractErrorMessage` is not exported from `./useApiClient` (module has no export of that name).

- [ ] **Step 3: Read the current file**

Read `lib/hooks/useApiClient.ts` in full before editing — the two `if (!res.ok) { ... }` blocks (one in `apiFetch`, one in `streamFetch`) are currently identical duplicated logic; both get replaced by a call to the new shared helper.

- [ ] **Step 4: Implement `extractErrorMessage` and wire it into both call sites**

At the top of `lib/hooks/useApiClient.ts`, right after the `import { auth } from "@/lib/firebase/client";` line, add:

```typescript
// A route returning `{ error: parsed.error.flatten() }` on a zod validation
// failure (the convention across ~30 API routes' safeParse error branches)
// used to reach here as a non-string `error`, so the generic fallback below
// fired even though the server sent a specific, useful reason. This pulls
// that reason back out instead of discarding it.
type ZodFlattenedError = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };

function isZodFlattenedError(value: unknown): value is ZodFlattenedError {
  return typeof value === "object" && value !== null && ("formErrors" in value || "fieldErrors" in value);
}

export function extractErrorMessage(err: unknown, status: number): string {
  const parsed = err as { error?: unknown; message?: unknown };
  if (typeof parsed.error === "string") return parsed.error;
  if (isZodFlattenedError(parsed.error)) {
    const fieldMessage = Object.values(parsed.error.fieldErrors ?? {})
      .flat()
      .find((m): m is string => Boolean(m));
    if (fieldMessage) return fieldMessage;
    const formMessage = parsed.error.formErrors?.find((m) => Boolean(m));
    if (formMessage) return formMessage;
  }
  if (typeof parsed.message === "string") return parsed.message;
  return `Request failed (${status})`;
}
```

Then in `apiFetch`, replace:

```typescript
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    const msg = typeof err.error === "string"
      ? err.error
      : err.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
```

with:

```typescript
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(extractErrorMessage(err, res.status));
  }
```

And make the identical replacement in `streamFetch`'s matching `if (!res.ok) { ... }` block (same current code, same replacement).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/hooks/useApiClient.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the full suite and lint to confirm nothing else broke**

Run: `npm test && npm run lint`
Expected: all existing tests still pass, no new lint errors.

- [ ] **Step 7: Commit**

```bash
git add lib/hooks/useApiClient.ts lib/hooks/useApiClient.test.ts
git commit -m "fix: surface real validation/moderation error messages instead of generic 400

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Render links in `PostMentionText`

**Files:**
- Modify: `components/feed/PostMentionText.tsx`
- Test: `components/feed/PostMentionText.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: no new exports — `PostMentionText`'s existing props (`content: string`, `onMentionClick: (userId: string) => void`) are unchanged. Task 4 (composer UI) relies on this task being done so that inserted link tokens actually render, but does not import anything new from this file.

- [ ] **Step 1: Write the failing tests**

Create `components/feed/PostMentionText.test.ts`:

```typescript
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostMentionText } from "./PostMentionText";

const noop = () => {};

describe("PostMentionText", () => {
  it("renders a bare URL as a clickable link", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "check this out https://example.com/path", onMentionClick: noop })
    );
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain(">https://example.com/path<");
  });

  it("renders a [label](url) link with the label as the visible text, not the raw URL", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, {
        content: "Survey link: [Complete the survey here](https://example.com/survey)",
        onMentionClick: noop,
      })
    );
    expect(html).toContain('href="https://example.com/survey"');
    expect(html).toContain(">Complete the survey here<");
    expect(html).not.toContain("[Complete the survey here]");
  });

  it("renders a link immediately adjacent to a mention token without cross-matching", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "@[Jane|user-1]https://example.com", onMentionClick: noop })
    );
    expect(html).toContain(">Jane<");
    expect(html).toContain('href="https://example.com"');
  });

  it("leaves [label](not a url) as plain text", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "[label](not a url)", onMentionClick: noop })
    );
    expect(html).not.toContain("<a");
    expect(html).toContain("[label](not a url)");
  });

  it("never turns a javascript: string into a clickable href", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "click javascript:alert(1) now", onMentionClick: noop })
    );
    expect(html).not.toContain("<a");
    expect(html).not.toContain('href="javascript:');
  });

  it("still renders an account tag pill unaffected by the new link patterns", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "Shoutout to #[Flyland Recovery|acct-1]", onMentionClick: noop })
    );
    expect(html).toContain("Flyland Recovery");
    expect(html).not.toContain("<a");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/feed/PostMentionText.test.ts`
Expected: FAIL on the first three tests (no `<a>` rendered for either link form yet); the last three already pass against current behavior.

- [ ] **Step 3: Read the current file**

Read `components/feed/PostMentionText.tsx` in full before editing (already reviewed during design — the `parts.map` block is what changes).

- [ ] **Step 4: Implement link rendering**

Replace the full contents of `components/feed/PostMentionText.tsx` with:

```typescript
import React from "react";
import { Building2 } from "lucide-react";

/**
 * Renders post/comment content, turning `@[Name|userId]` mention tokens into
 * clickable buttons, `#[Name|accountId]` account-tag tokens into
 * non-interactive labeled pills, and links into real anchor tags — either
 * `[label](https://...)` (a custom label the composer's "Add Link" control
 * inserts) or a bare `https://...` run, pasted or typed directly. Extracted
 * out of feed/page.tsx so the media viewer sidebar and CommentThread can
 * render the same body text without duplicating the parsing regex.
 *
 * Account tags are deliberately NOT clickable -- there is no account detail
 * page, and none is needed; #account is purely a visual/contextual tag (see
 * docs/superpowers/specs/2026-09-02-feed-account-mentions-design.md).
 *
 * Both link forms require a literal http(s):// prefix to ever become an
 * `href` -- this is what rules out a `javascript:`/`data:` scheme ever
 * being clickable, by construction, not by sanitizing after the fact. A
 * markdown-style link's URL is closed by the first `)` (so a URL containing
 * a literal `)` won't fully parse) and a bare URL run is closed by the first
 * whitespace -- both deliberate simplicity trade-offs, not bugs (see
 * docs/superpowers/specs/2026-09-10-feed-clickable-links-design.md).
 */
const LINK_CLASSES = "font-medium text-navy-600 underline hover:text-navy-800 transition-colors";

export function PostMentionText({
  content,
  onMentionClick,
}: {
  content: string;
  onMentionClick: (userId: string) => void;
}) {
  const parts = content.split(
    /(@\[[^|]+\|[^\]]+\]|#\[[^|]+\|[^\]]+\]|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/\S+)/g
  );
  return (
    <>
      {parts.map((part, i) => {
        const mentionMatch = part.match(/^@\[([^|]+)\|([^\]]+)\]$/);
        if (mentionMatch) {
          const [, name, id] = mentionMatch;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMentionClick(id)}
              className="font-semibold text-navy-600 bg-navy-50 rounded-md px-1 py-0.5 hover:bg-navy-100 transition-colors cursor-pointer"
            >
              @{name}
            </button>
          );
        }
        const accountMatch = part.match(/^#\[([^|]+)\|([^\]]+)\]$/);
        if (accountMatch) {
          const [, name] = accountMatch;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-gray-100 rounded-md px-1 py-0.5"
            >
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
              {name}
            </span>
          );
        }
        const labeledLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (labeledLinkMatch) {
          const [, label, url] = labeledLinkMatch;
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>
              {label}
            </a>
          );
        }
        const bareUrlMatch = part.match(/^(https?:\/\/\S+)$/);
        if (bareUrlMatch) {
          const url = bareUrlMatch[1];
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={`${LINK_CLASSES} break-all`}>
              {url}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/feed/PostMentionText.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the full suite and lint**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all pass, no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/feed/PostMentionText.tsx components/feed/PostMentionText.test.ts
git commit -m "feat: render links in Feed post/comment/reply content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Add `buildLinkToken` and the `insertLink` composer action to `useFeedActions`

**Files:**
- Modify: `lib/hooks/useFeedActions.ts`
- Test: `lib/hooks/useFeedActions.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces:
  - `buildLinkToken(url: string, label: string): string` — exported module-level pure function.
  - New hook state returned from `useFeedActions()`: `linkPanelOpen: boolean`, `setLinkPanelOpen: (v: boolean) => void`, `linkUrl: string`, `setLinkUrl: (v: string) => void`, `linkLabel: string`, `setLinkLabel: (v: string) => void`.
  - New hook handler returned from `useFeedActions()`: `insertLink: () => void`.
  - Task 4 consumes all of the above by name exactly as listed.

- [ ] **Step 1: Write the failing test**

Create `lib/hooks/useFeedActions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildLinkToken } from "./useFeedActions";

describe("buildLinkToken", () => {
  it("wraps the url with the label as markdown-style link text", () => {
    expect(buildLinkToken("https://example.com/survey", "Complete the survey here"))
      .toBe("[Complete the survey here](https://example.com/survey)");
  });

  it("returns the bare url when no label is given", () => {
    expect(buildLinkToken("https://example.com", "")).toBe("https://example.com");
  });

  it("returns the bare url when the label is only whitespace", () => {
    expect(buildLinkToken("https://example.com", "   ")).toBe("https://example.com");
  });

  it("prepends https:// to a url with no protocol", () => {
    expect(buildLinkToken("example.com", "")).toBe("https://example.com");
  });

  it("does not double-prepend https:// when already present", () => {
    expect(buildLinkToken("http://example.com", "")).toBe("http://example.com");
  });

  it("trims surrounding whitespace from the url and label", () => {
    expect(buildLinkToken("  https://example.com  ", "  Survey  "))
      .toBe("[Survey](https://example.com)");
  });

  it("strips a stray ] from the label so it can't prematurely close the token", () => {
    expect(buildLinkToken("https://example.com", "click here]"))
      .toBe("[click here](https://example.com)");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/hooks/useFeedActions.test.ts`
Expected: FAIL — `buildLinkToken` is not exported from `./useFeedActions`.

- [ ] **Step 3: Read the current file**

Read `lib/hooks/useFeedActions.ts` in full before editing (already reviewed during design). The edits below touch: the module-level function block near the top (add `buildLinkToken` next to `decodeMentions`/`encodeMentions`), the state declarations inside `useFeedActions()`, the `handlePost` success-reset block, a new `insertLink` function placed next to `insertAccount`, and the final returned object.

- [ ] **Step 4: Add `buildLinkToken`**

In `lib/hooks/useFeedActions.ts`, right after the existing `encodeMentions` function (before the `MAX_VIDEO_BYTES` comment), add:

```typescript
// Builds the stored form of a link inserted via the composer's "Add Link"
// control: `[label](url)` when a label is given, or just the bare url
// (which PostMentionText auto-linkifies on its own) when it's not -- so the
// renderer never needs to special-case the two. A stray "]" is stripped
// from the label since it would prematurely close the markdown token when
// rendered (PostMentionText's label pattern is "anything but ]").
export function buildLinkToken(url: string, label: string): string {
  const trimmedUrl = url.trim();
  const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  const cleanLabel = label.trim().replace(/\]/g, "");
  return cleanLabel ? `[${cleanLabel}](${normalizedUrl})` : normalizedUrl;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/hooks/useFeedActions.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Wire `insertLink` and its state into the hook**

In `lib/hooks/useFeedActions.ts`, inside `useFeedActions()`, find this existing state declaration:

```typescript
  const [shoutoutMode, setShoutoutMode] = useState(false);
```

Add these three lines directly above it:

```typescript
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
```

Next, find the `insertAccount` function:

```typescript
  function insertAccount(acct: AccountEntity) {
    const cursor = composerRef.current?.selectionStart ?? newPost.length;
    setNewPost(accountTag.select(newPost, cursor, acct));
    setTimeout(() => composerRef.current?.focus(), 0);
  }
```

Add this new function directly after it:

```typescript
  function insertLink() {
    if (!linkUrl.trim()) return;
    const token = buildLinkToken(linkUrl, linkLabel);
    const cursor = composerRef.current?.selectionStart ?? newPost.length;
    const before = newPost.slice(0, cursor);
    const after = newPost.slice(cursor);
    setNewPost(`${before}${token}${after}`);
    setLinkPanelOpen(false);
    setLinkUrl("");
    setLinkLabel("");
    setTimeout(() => composerRef.current?.focus(), 0);
  }
```

Next, find this block inside `handlePost` (the shared post-submit reset, right after the `if (shoutoutMode) {...} else {...}` branches):

```typescript
      setNewPost("");
      if (composerRef.current) composerRef.current.style.height = "auto";
      clearImages();
      clearVideo();
      await load();
```

Replace it with:

```typescript
      setNewPost("");
      if (composerRef.current) composerRef.current.style.height = "auto";
      clearImages();
      clearVideo();
      setLinkPanelOpen(false); setLinkUrl(""); setLinkLabel("");
      await load();
```

Finally, in the object returned by `useFeedActions()`, find:

```typescript
    shoutoutMode, setShoutoutMode,
```

Add directly above it:

```typescript
    linkPanelOpen, setLinkPanelOpen,
    linkUrl, setLinkUrl,
    linkLabel, setLinkLabel,
```

And find:

```typescript
    insertMention,
    insertAccount,
```

Replace with:

```typescript
    insertMention,
    insertAccount,
    insertLink,
```

- [ ] **Step 7: Run the full suite, lint, and typecheck**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all pass. (No component yet consumes `insertLink`/`linkPanelOpen` — Task 4 wires those into the UI. `tsc --noEmit` confirms the hook itself is still well-typed on its own.)

- [ ] **Step 8: Commit**

```bash
git add lib/hooks/useFeedActions.ts lib/hooks/useFeedActions.test.ts
git commit -m "feat: add insertLink composer action to useFeedActions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Add the "Add Link" composer control to the Feed page

**Files:**
- Modify: `app/(dashboard)/feed/page.tsx`

**Interfaces:**
- Consumes (from Task 3's `useFeedActions()` return value, by exact name): `linkPanelOpen`, `setLinkPanelOpen`, `linkUrl`, `setLinkUrl`, `linkLabel`, `setLinkLabel`, `insertLink`.
- Consumes (from Task 2, implicitly): `PostMentionText` renders whatever this composer inserts as a real link — no direct import needed, this task only produces the composer-side text.
- Produces: nothing new consumed by another task; this is the last task in the chain.

This task has no dedicated automated test — `app/(dashboard)/feed/page.tsx` has no existing `.test.ts` coverage of its own (it's the top-level page component; the repo's test convention exercises the extracted hook/render logic in Tasks 1-3 instead). Verification here is a manual smoke test against the running app, per the design spec.

- [ ] **Step 1: Read the current file**

Read `app/(dashboard)/feed/page.tsx` in full before editing — specifically the `import` block (top of file) and the composer toolbar `<div className="flex items-center gap-2 flex-wrap">...</div>` block (already reviewed during design), plus the `{pollMode && (...)}` block that immediately follows it.

- [ ] **Step 2: Add the `Link2` icon import**

Find this import line:

```typescript
import { Send, ImagePlus, Clapperboard, X, Megaphone, BarChart2, Sparkles, Star, Gamepad2, ShoppingBag, AlertCircle, Loader2, Cake, Building2, EyeOff } from "lucide-react";
```

Replace with (added `Link2` — not `Link`, which would collide with the `Link` import from `next/link` two lines above):

```typescript
import { Send, ImagePlus, Clapperboard, X, Megaphone, BarChart2, Sparkles, Star, Gamepad2, ShoppingBag, AlertCircle, Loader2, Cake, Building2, EyeOff, Link2 } from "lucide-react";
```

- [ ] **Step 3: Destructure the new hook fields**

Find this line in the `useFeedActions()` destructure:

```typescript
    shoutoutMode, setShoutoutMode,
```

Add directly above it:

```typescript
    linkPanelOpen, setLinkPanelOpen,
    linkUrl, setLinkUrl,
    linkLabel, setLinkLabel,
```

Find:

```typescript
    insertMention,
    insertAccount,
```

Replace with:

```typescript
    insertMention,
    insertAccount,
    insertLink,
```

- [ ] **Step 4: Add the "Add Link" toolbar button**

Find the end of the composer toolbar block:

```typescript
              <Sparkles className="w-3.5 h-3.5" /> Shoutout
            </button>
          </div>
```

Replace with (new button inserted before the toolbar `</div>` closes):

```typescript
              <Sparkles className="w-3.5 h-3.5" /> Shoutout
            </button>
            <button
              type="button"
              onClick={() => setLinkPanelOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                linkPanelOpen
                  ? "bg-command-black border-command-black text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-navy-300 hover:text-navy-600"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" /> Add Link
            </button>
          </div>
```

- [ ] **Step 5: Add the insert-link panel**

Immediately after that same toolbar `</div>` (i.e., right before the existing `{pollMode && (` block), add:

```typescript

          {linkPanelOpen && (
            <div className="space-y-2 pl-1">
              <input
                type="text"
                placeholder="Paste a URL…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
              />
              <input
                type="text"
                placeholder="Link text (optional) — e.g. \"Complete the survey here\""
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={insertLink}
                  disabled={!linkUrl.trim()}
                  className="flex items-center gap-1.5 bg-command-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => { setLinkPanelOpen(false); setLinkUrl(""); setLinkLabel(""); }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
```

- [ ] **Step 6: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors. (No unit test exists for this file per the repo's own convention — see Task header.)

- [ ] **Step 7: Manual smoke test in the running app**

Run: `npm run dev` (serves on `localhost:3010`)

In the browser, on the Feed page:
1. Expand the composer, click "Add Link". Confirm the URL/Label panel appears and "Insert" is disabled until a URL is typed.
2. Type a URL and a label (e.g. `https://example.com` / `Complete the survey here`), click Insert. Confirm `[Complete the survey here](https://example.com)` appears in the caption textarea at the cursor position, and the panel closes.
3. Fill in the required title/flair, submit. Confirm the post appears in the feed with **"Complete the survey here"** rendered as blue underlined clickable text (not the raw URL), and that clicking it opens `https://example.com` in a new tab.
4. Start a new post, paste a bare URL directly into the caption with no label (e.g. `https://example.com/foo`), submit. Confirm it renders as clickable blue underlined text showing the full URL.
5. Trigger a real validation error (e.g. click Post with a link in the caption but no flair selected). Confirm the toast shows a specific reason (e.g. mentioning the missing flair/title) instead of `"Request failed (400)"`.
6. Per this repo's own `CLAUDE.md`: this is production data. Delete both test posts created above via the app's own UI once verification is complete.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/feed/page.tsx"
git commit -m "feat: add Add Link control to the Feed post composer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests pass, including the three new test files from Tasks 1-3.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Confirm branch state**

Run: `git log --oneline main..HEAD`
Expected: 4 commits (Tasks 1, 2, 3, 4 — Task 5 has no commit of its own, it's a verification-only pass).

- [ ] **Step 4: Open a pull request**

Per this repo's git workflow (`CLAUDE.md`: never push directly to `main`), push the branch and open a PR:

```bash
git push -u origin feat/feed-clickable-links
gh pr create --title "Feed: clickable links (auto-linkify + custom-label links)" --body "$(cat <<'EOF'
## Summary
- Bare URLs and new `[label](url)`-style links in Feed posts/comments/replies now render as real clickable links, not inert text.
- New "Add Link" control in the main post composer lets an author give a link a short custom label (matches the reference UX from the reported issue).
- Fixed an unrelated bug found during investigation: a validation failure on any of the 33 routes returning `{ error: zodError.flatten() }` now surfaces its real reason via `apiFetch`/`streamFetch` instead of a generic "Request failed (400)".

See `docs/superpowers/specs/2026-09-10-feed-clickable-links-design.md` for the full design and `docs/superpowers/plans/2026-09-10-feed-clickable-links.md` for the implementation plan.

## Test plan
- [x] `npm test` — new tests in `useApiClient.test.ts`, `PostMentionText.test.ts`, `useFeedActions.test.ts`
- [x] `npm run lint`, `npx tsc --noEmit`
- [x] Manual smoke test in the running app (labeled link, bare URL, and a real validation error message)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
