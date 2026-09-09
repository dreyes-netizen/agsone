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
    /(@\[[^|]+\|[^\]]+\]|#\[[^|]+\|[^\]]+\]|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/\S+)/gi
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
        const labeledLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
        if (labeledLinkMatch) {
          const [, label, url] = labeledLinkMatch;
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>
              {label}
            </a>
          );
        }
        const bareUrlMatch = part.match(/^(https?:\/\/\S+)$/i);
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
