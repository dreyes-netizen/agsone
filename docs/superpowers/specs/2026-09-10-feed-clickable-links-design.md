# Feed Clickable Links — Design Spec

## Summary

A URL typed or pasted into a Feed post caption (or a comment/reply) already saves and posts
fine today — it just renders as inert plain text, unclickable. This adds two ways to get a
working link: a bare URL auto-linkifies as-is, and a new "Add Link" composer control lets an
author give a URL a short custom label (e.g. "Complete the August survey here") that renders
as the clickable text instead of the raw URL. Alongside this, a related bug found while
investigating gets fixed: a validation failure on `POST`/`PATCH /api/feed*` (and 32 other
routes sharing the same convention) currently surfaces to the user as an opaque
`"Request failed (400)"` instead of the real reason.

## Goals

- A bare `https://...` URL in a post, comment, or reply body renders as a clickable link,
  wherever that content is displayed.
- An author can attach a short custom label to a link instead of showing the raw URL, via a
  new composer control on the main post composer.
- No new XSS surface: a link can only ever be constructed from an explicit `http://`/`https://`
  prefix, so a `javascript:`/`data:` scheme can never become a clickable `href`.
- A validation error on any of the 33 API routes returning `{ error: zodError.flatten() }`
  shows its real, specific reason to the user instead of a generic `"Request failed (400)"`.

## Non-goals (v1)

- No rich link-preview cards (fetched title/image/description, Slack/Facebook-style). Would
  require a new server endpoint fetching arbitrary employee-submitted URLs (an SSRF surface),
  caching, and CSP changes for external images — real scope growth beyond what was asked.
- No "Add Link" composer control in comments/replies — only the main post composer. Comments
  and replies still render any link that ends up in them (bare or `[label](url)`, however it
  gets there), since the rendering fix is shared; they just don't get the new insert-link UI.
- No new UI for editing an existing link in edit mode. Edit mode is already a plain textarea
  (no image/video/poll editing either); a `[label](url)` already in the content shows as
  literal, hand-editable text there, unchanged from how mention tokens already behave in edit.
- No sweep of the other 32 routes sharing the `error.flatten()` pattern beyond fixing the
  client-side handling that affects all of them — no route file itself is touched.

## Architecture

**Rendering: extend the existing token renderer.** `components/feed/PostMentionText.tsx` is
already the single shared renderer for post bodies, comments, and replies, and already
regex-splits content into plain text vs. special tokens (`@[Name|id]` mentions, `#[Name|id]`
account tags). Two more token patterns are added to the same split/render pass:

- `[label](https://...)` or `[label](http://...)` — rendered as `<a>{label}</a>`.
- A bare `https://...`/`http://...` run — rendered as `<a>{url}</a>`.

Both render with the same `text-navy-600` token this component already uses for mention pills
(plus an underline, since a pill background would read as a mention, not a link) — no new
color introduced, and `target="_blank" rel="noopener noreferrer"` like any other outbound link
in the app.

Because the regex requires the literal `https?://` prefix to ever populate an `href`, there is
no code path by which a `javascript:`/`data:` string can become a clickable link — this holds
for both the bare-URL and the `[label](url)` form.

**Authoring: a new composer control, main post composer only.** An "Add Link" button joins the
existing Photo / Video / Add Poll row in `app/(dashboard)/feed/page.tsx`, same button styling.
Clicking it opens a small inline panel (URL field, required; Label field, optional). Confirming
inserts `[label](url)` at the cursor into the compose textarea — same insertion mechanism
already used for `insertAccount`/mention selection (`lib/hooks/useFeedActions.ts`). If Label is
left blank, the bare URL is inserted instead, which auto-linkifies anyway — no special-casing
needed between the two forms once they're in the content string. If the entered URL has no
`http(s)://` prefix, `https://` is prepended automatically before insertion.

No encode/decode step is needed for links on either the create or edit path: unlike mentions
(which store `@[Name|id]` but must round-trip through a human-typed `@Name` for editing,
since raw IDs aren't meaningful to type), a link's stored form (`[label](url)` or a bare URL)
*is* already what a person would reasonably type or edit by hand, so it passes through
`buildContent`/`decodeMentions`/`encodeMentions` untouched.

## Components

| File | Responsibility |
|---|---|
| `components/feed/PostMentionText.tsx` (modified) | Add the two link-token patterns to the existing split/render regex; new `<a>` rendering branch for each. |
| `app/(dashboard)/feed/page.tsx` (modified) | New "Add Link" toolbar button + inline URL/Label insert panel, main composer only. |
| `lib/hooks/useFeedActions.ts` (modified) | Insertion helper for the link panel (mirrors the existing `insertAccount` pattern) — writes `[label](url)` or the bare URL into `newPost` at the cursor. |
| `lib/hooks/useApiClient.ts` (modified) | `apiFetch`/`streamFetch`: when `err.error` is a zod `flatten()` shape (`{formErrors, fieldErrors}`) instead of a string, extract a readable message from it rather than falling back to the generic `"Request failed (${status})"`. |

No schema changes, no new API routes, no new dependencies.

## Data flow

**Authoring a labeled link:**
1. Author clicks "Add Link" in the composer, enters a URL (and optionally a label), confirms.
2. `[label](url)` (or the bare URL, if no label) is inserted into the textarea at the cursor —
   same as any other typed text from this point on.
3. On submit, this text flows through `buildContent()` unchanged (only its mention-token pass
   applies) and is saved as part of `content`, exactly like today.

**Rendering (post, comment, or reply):**
1. `PostMentionText` receives `content`, splits it into tokens (mention / account-tag /
   `[label](url)` link / bare-URL link / plain text) in one pass.
2. Each link token renders as an `<a href={url} target="_blank" rel="noopener noreferrer">`
   with the label (or the raw URL, for the bare-URL case) as its text.

**Validation error surfacing (unrelated bug fix, same investigation):**
1. A route rejects a request with `{ error: parsed.error.flatten() }` (object, not string) —
   unchanged, no route files are touched.
2. `apiFetch`/`streamFetch` now recognizes this shape and extracts a real message (e.g. the
   first `formErrors` entry, or the first `fieldErrors` entry) instead of discarding it.
3. The composer's existing `catch (err) { setPostToast(err.message) }` path (already in place)
   now shows that real message instead of `"Request failed (400)"`, with no changes needed on
   the calling side.

## Error handling

- **Malformed markdown-link syntax** (e.g. `[label](not a url)`, or an unclosed `[label]`)
  simply fails to match the link-token pattern and is emitted as ordinary plain text — no error
  state, no special handling needed, matches how an unmatched `@[` would already fall through
  today.
- **Insert-Link panel**: the Insert action is disabled until the URL field is non-empty; no
  network call is involved (pure client-side textarea insertion), so there's no failure mode to
  handle beyond that.
- **`apiFetch` flatten-extraction**: if the object doesn't match the expected `flatten()` shape
  (defensive case — a future route returning some other error shape), falls back to the
  existing generic message unchanged. This is a strict improvement with no new failure mode.

## Testing

Matching this repo's existing convention for this kind of component (`.test.ts`, not `.tsx`,
using `renderToStaticMarkup` from `react-dom/server` — see `components/minigames/solo/SoloGameGrid.test.ts`):

- `PostMentionText.test.ts`: a bare URL renders as a clickable `<a>`; `[label](url)` renders
  the label as the link text with the URL as `href`; a link immediately adjacent to a mention
  token renders both correctly with no cross-matching; `[text](not a url)` and a bare
  `javascript:alert(1)` string both render as plain text, never as an `<a href>`.
- `useApiClient.test.ts` (new): a `flatten()`-shaped error object is turned into a readable
  message; a plain string `error` still works as it does today; an unrecognized error shape
  falls back to the existing generic message.
- Manual smoke test in the running composer: insert a labeled link, submit, confirm it renders
  clickable in the feed; paste a bare URL, confirm the same; trigger a real validation error
  (e.g. submit with a link but no flair selected) and confirm the toast shows a specific reason
  instead of "Request failed (400)".
