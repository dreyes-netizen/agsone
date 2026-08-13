"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Clamps long post text to 5 lines and only shows a "See more" toggle when
 * the text actually overflows that clamp — measured via scrollHeight vs.
 * clientHeight rather than a character count, so wrapping/line-length still
 * decides it correctly. Short posts never get a toggle. Expanding/collapsing
 * is local state, not a link, so it never navigates.
 */
export function ExpandableText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (expanded) return; // already revealed — no need to re-measure until content changes
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [expanded, children]);

  return (
    <div>
      <p ref={ref} className={`${className ?? ""} ${expanded ? "" : "line-clamp-5"}`}>
        {children}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-navy-600 hover:text-navy-800 mt-1 transition-colors"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
