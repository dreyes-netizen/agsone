/**
 * Pure, dependency-free mention-token utilities. Split out of parseMentions.ts
 * (which imports the Prisma client for resolveMentionRecipients) so client
 * components — like NotificationBell, which strips tokens for display — can
 * import this without pulling server-only code into the browser bundle.
 */

// Deliberately strict on the id half. The display-name half is free text
// (names contain spaces, apostrophes, hyphens) but must not contain the
// delimiters, so a malformed token simply fails to match rather than
// swallowing the rest of the post.
export const MENTION_TOKEN = /@\[([^\]|]{1,100})\|([0-9a-fA-F-]{36})\]/g;

/** Pull the candidate user ids out of a post body. Unvalidated. */
export function extractMentionIds(content: string | null | undefined): string[] {
  if (!content) return [];
  const ids = new Set<string>();
  for (const match of content.matchAll(MENTION_TOKEN)) {
    ids.add(match[2].toLowerCase());
  }
  return [...ids];
}

/**
 * Replace `@[Name|uuid]` tokens with plain `@Name` text. Used both when a
 * notification body is generated server-side and when NotificationBell
 * renders a body at display time — the latter also covers notification rows
 * written before this stripping existed, since it never trusts stored data
 * to already be clean.
 */
export function stripMentionTokens(content: string): string {
  return content.replace(MENTION_TOKEN, (_match, name: string) => `@${name}`);
}
