import React from "react";

/**
 * Renders post content, turning `@[Name|userId]` mention tokens (written by
 * the composer's mention picker) into clickable buttons. Extracted out of
 * feed/page.tsx so the media viewer sidebar can render the same post body
 * without duplicating the parsing regex.
 */
export function PostMentionText({
  content,
  onMentionClick,
}: {
  content: string;
  onMentionClick: (userId: string) => void;
}) {
  const parts = content.split(/(@\[[^\|]+\|[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^\|]+)\|([^\]]+)\]$/);
        if (match) {
          const [, name, id] = match;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMentionClick(id)}
              className="font-semibold text-blue-600 bg-blue-50 rounded-md px-1 py-0.5 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              @{name}
            </button>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
