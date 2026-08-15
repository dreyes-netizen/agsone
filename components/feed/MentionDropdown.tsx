"use client";

import { Avatar } from "./Avatar";
import type { MentionEmployee, MentionInput } from "@/lib/hooks/useMentionInput";

/**
 * The @mention autocomplete list, positioned above the composer it belongs to.
 *
 * Rendered with `onMouseDown` rather than `onClick` so the selection lands
 * before the textarea's blur fires and closes the list.
 *
 * Unlike the feed composer's original inline dropdown, this one supports
 * keyboard navigation — see handleMentionKeyDown in the composers. A listbox
 * you can only reach with a mouse is not really usable.
 */
export function MentionDropdown({
  mention,
  onSelect,
  className,
}: {
  mention: MentionInput;
  onSelect: (emp: MentionEmployee) => void;
  className?: string;
}) {
  if (!mention.open) return null;

  return (
    <ul
      role="listbox"
      aria-label="Mention a colleague"
      className={
        className ??
        "absolute bottom-full left-0 mb-1 z-30 w-64 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
      }
    >
      {mention.results.map((emp, i) => (
        <li key={emp.id}>
          <button
            type="button"
            role="option"
            aria-selected={i === mention.activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(emp);
            }}
            onMouseEnter={() => mention.setActiveIndex(i)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              i === mention.activeIndex ? "bg-navy-50 text-gray-900" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Avatar name={emp.displayName} url={null} size="sm" />
            <span className="truncate">{emp.displayName}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
