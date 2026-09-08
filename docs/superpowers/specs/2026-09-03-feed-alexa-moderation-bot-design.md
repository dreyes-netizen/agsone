# Feed Moderation Bot ("Alexa") — Design Spec

## Summary

An AI moderation gate for the Feed, named **Alexa**: every new post, comment, and reply (and
any edit to one) is checked by an AI classifier before it's saved. Content that reads as
harassment, slurs, personal attacks, or threats is rejected outright — banter, teasing, and
jokes in the gray area are allowed through. Nothing offensive is ever visible in the Feed,
even briefly.

## Goals

- Catch genuinely harmful content (harassment, slurs, personal attacks, threats) before it's
  ever visible to anyone in the Feed.
- Leave ordinary workplace banter and jokes alone, even when they sit in a gray area — the
  standard is "not below the belt," not "inoffensive."
- Give HR a reviewable trail of what got blocked and why, without inventing a fake bot user
  account or a new authorization model.
- Do this without making the Feed composer unusable if the AI provider has an outage.

## Non-goals (v1)

- No retroactive scan of content already in the Feed before Alexa exists — forward-looking only
  (new posts/comments/replies, and edits to existing ones).
- No HR-admin-configurable moderation prompt/rules UI — the standard is a fixed system prompt,
  changed by editing code, not a settings page.
- No image/GIF analysis beyond Feed GIF comments specifically (no analysis of uploaded photos).
- No "flag for human review" queue — a violation is rejected outright, not held for approval.

## Architecture

A single new guardrail module, `lib/guardrails/moderation.ts`, checked synchronously in the
same request as post/comment create and edit — **before** the Prisma write — mirroring exactly
where `isJailbreakAttempt()` already runs before the LLM call in
`app/api/assistant/chat/route.ts`. If it flags the content, the request is rejected (400) and
nothing is saved — same shape as an existing zod validation error, just AI-driven instead of
rule-based.

**Provider: OpenAI `gpt-4o-mini`.** Chosen over the previously-considered Groq/Gemini split
because it's a single multimodal model — one provider handles both the text check (title/body)
and the image check (GIF comments), instead of needing two separate providers wired in. Cost-
efficient tier, confirmed live end-to-end (chat completion in ~200ms) during design.

- **Text check**: post title + body (or comment/reply body) sent as the user content, alongside
  a system prompt encoding the standard — banter/jokes/teasing okay, harassment/slurs/personal
  attacks/threats not okay — with 2-3 calibration examples baked into the prompt. One example:
  a manager posts a joking "you're my next target 🎯" meme GIF in a lighthearted thread; the
  recipient replies with a teasing pushback — this should be **allowed**, not blocked, since
  read in context it's banter, not harassment. (Grounded in a real example reviewed during
  design; details generalized here, not reproduced verbatim, to avoid naming anyone in a
  committed doc.)
- **Image check (GIF comments only)**: `SocialComment.commentType === "GIF"` rows carry a
  Giphy `gifId` with no caption text. Resolve it to `https://media.giphy.com/media/{gifId}/giphy.gif`
  (public CDN, no Giphy API key needed — confirmed working) and send it as an image content
  block in the **same** request as the surrounding text context (the comment it's replying to,
  or the post it's on) — a GIF's meaning depends on the thread it's dropped into, so it's judged
  in context, not in isolation.
- Both checks return one structured result via OpenAI's JSON response mode (not free-text
  parsing): `{blocked: boolean, reason?: string}`.

## Components

| File | Responsibility |
|---|---|
| `lib/openai/client.ts` (new) | Thin OpenAI SDK wrapper, same shape as `lib/groq/client.ts`. Reads `OPENAI_API_KEY`. |
| `lib/guardrails/moderation.ts` (new) | `moderateContent({ title?, body, gifId? }): Promise<{blocked: boolean, reason?: string}>` — builds the request (system prompt + calibration examples + text, plus an image block for GIFs), calls `gpt-4o-mini` with structured JSON output, returns the parsed result. Fail-open on any error (see Error Handling). |
| `lib/constants/auditActions.ts` (modified) | Add `ALEXA_BLOCKED_POST` / `ALEXA_BLOCKED_COMMENT` labels alongside the existing `DELETE_POST`/`DELETE_COMMENT`. |
| `app/api/feed/route.ts` (modified) | POST — call `moderateContent()` after zod validation, before `prisma.socialPost.create()`. |
| Post edit route (modified) | Same, before `prisma.socialPost.update()`. |
| Comment create/edit routes (modified) | Same pattern for `SocialComment`. |
| `lib/guardrails/rateLimiter.ts` (modified) | Add a `moderation` scope to `SCOPE_CONFIG` — every submission now triggers a paid API call, so reuse the existing per-user rate limiter (same pattern as the `assistant` scope) rather than building new abuse protection. |

No schema changes. No new "system/bot" `User` row — a block is logged with the **real author**
as the `AuditLog` actor (satisfies the existing required `actorId` FK with zero workarounds),
action `ALEXA_BLOCKED_POST`/`ALEXA_BLOCKED_COMMENT`, `beforeState` holding the rejected content
and Alexa's reason. This also lets HR spot patterns (e.g. repeat attempts) without inventing new
authorization machinery.

## Data flow

1. Client submits a post/comment (create or edit) via the existing composer.
2. Route: `verifyAuth` → zod `safeParse` → **`moderateContent()`** →
   - **Blocked**: return `400 { error, moderated: true, reason }`; write the `AuditLog` entry;
     nothing saved.
   - **Allowed**: proceed to the existing Prisma create/update → `scheduleBroadcast` → response,
     unchanged from today.
3. Client: needs to distinguish a moderation rejection from an ordinary validation error (e.g.
   "add a title before posting") so it can render it with an Alexa-branded message instead of a
   generic one. The `moderated: true` flag in the error response is the signal for this.

## Error handling

**Fail open.** If the OpenAI call times out, errors, or returns a response that doesn't match
the expected structured shape, `moderateContent()` returns `{blocked: false}` and logs the
failure server-side (`console.error`). The post/comment is saved as if no violation was found.

Rationale: an internal engagement tool shouldn't become unusable app-wide because a third-party
API had a blip — the risk of an occasional violation slipping through during a rare outage is
preferable to breaking posting/commenting entirely. This mirrors the existing rate-limiter's own
fail-open behavior when Upstash env vars are absent.

A failed Giphy CDN fetch for a GIF check specifically degrades to running the text check only
(on the surrounding context) rather than failing the whole request.

## Testing

- Unit tests for `moderateContent()` (mock the OpenAI client, same `vi.mock` convention as
  existing tests): a clear violation → blocked; clear-fine banter → allowed; a gray-line joke
  fixture (generalized from the real "next target" GIF example, not the real one) → allowed; a
  malformed/failed API response → fail-open allowed.
- Route-level tests mirroring the existing feed route test conventions: a blocked submission →
  `400`, `AuditLog` row written, no `SocialPost`/`SocialComment` row created; an allowed
  submission → proceeds exactly as it does today.
- No automated test asserts on the AI's actual judgment quality end-to-end (inherently
  non-deterministic) — a manual smoke test after implementation confirms the wiring works with a
  real API call.

## Open risk, called out explicitly

A moderation bot here isn't just a UX nicety — false positives (blocking legitimate banter) and
false negatives (missing real hostility) both have consequences beyond the Feed itself, since
Feed content can factor into real HR/disciplinary conversations. The audit trail (every block
logged with full content + reason, attributed to the real author) exists specifically so a
human can review and correct Alexa's calls, not just trust them silently. This is why v1
deliberately keeps a human able to see every decision, rather than shipping a fully opaque
auto-moderation black box.
