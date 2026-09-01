import React from "react";
import { Building2 } from "lucide-react";

/**
 * Renders post/comment content, turning `@[Name|userId]` mention tokens into
 * clickable buttons and `#[Name|accountId]` account-tag tokens into
 * non-interactive labeled pills. Extracted out of feed/page.tsx so the media
 * viewer sidebar and CommentThread can render the same body text without
 * duplicating the parsing regex.
 *
 * Account tags are deliberately NOT clickable -- there is no account detail
 * page, and none is needed; #account is purely a visual/contextual tag (see
 * docs/superpowers/specs/2026-09-02-feed-account-mentions-design.md).
 */
export function PostMentionText({
  content,
  onMentionClick,
}: {
  content: string;
  onMentionClick: (userId: string) => void;
}) {
  const parts = content.split(/(@\[[^|]+\|[^\]]+\]|#\[[^|]+\|[^\]]+\])/g);
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
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
