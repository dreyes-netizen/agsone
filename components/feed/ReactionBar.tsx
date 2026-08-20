"use client";

import React, { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { REACTIONS as EMOJIS } from "@/lib/constants/reactions";

/**
 * Just the interactive "React" trigger + its emoji picker — the reaction
 * count/summary line lives separately in PostEngagement so it can sit above
 * this button instead of squeezed beside it.
 *
 * `variant="post"` (default) renders the flat flex-1 segment used in the
 * post footer's two-up React/Comment row. `variant="compact"` renders a
 * small text trigger matching the Reply/Delete links in a comment's action
 * row, for the same picker reused on comments (see CommentThread).
 *
 * Takes no id — every caller already has the post/comment id in closure
 * scope for its own `onReact`, so round-tripping it through this component
 * would be pure ceremony.
 */
export function ReactionBar({
  myReactions,
  onReact,
  variant = "post",
}: {
  myReactions: string[];
  onReact: (emoji: string) => void;
  variant?: "post" | "compact";
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myReaction = myReactions[0] ?? null;

  function openPicker() {
    hoverTimer.current = setTimeout(() => setPickerOpen(true), 350);
  }
  function closePicker() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPickerOpen(false);
  }
  function handleMainClick() {
    if (myReaction) {
      onReact(myReaction); // toggle off
    } else {
      setPickerOpen((v) => !v);
    }
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (myReaction) {
        onReact(myReaction);
      } else {
        setPickerOpen((v) => !v);
      }
    } else if (e.key === "Escape" && pickerOpen) {
      e.preventDefault();
      closePicker();
    }
  }

  return (
    <div
      className={variant === "compact" ? "relative inline-block" : "relative flex-1"}
      onMouseEnter={openPicker}
      onMouseLeave={closePicker}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Floating picker — pb-2 bridges the gap so mouse doesn't leave container */}
      {pickerOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-20 pb-2 max-w-[92vw]">
          <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border border-gray-100 px-3 py-2.5 overflow-x-auto" role="group" aria-label="Emoji reactions">
            {EMOJIS.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                title={label}
                onClick={() => { onReact(emoji); closePicker(); }}
                className={`text-xl leading-none transition-all duration-150 hover:scale-[1.4] active:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-1 ${
                  myReaction === emoji ? "scale-125" : ""
                }`}
                aria-label={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleMainClick}
        aria-haspopup="true"
        aria-expanded={pickerOpen}
        aria-label={myReaction ? `Remove ${EMOJIS.find(e => e.emoji === myReaction)?.label ?? "reaction"}` : "Add reaction"}
        className={
          variant === "compact"
            ? `text-[11px] font-semibold transition-colors ${myReaction ? "text-navy-600" : "text-gray-500 hover:text-navy-600"}`
            : `flex w-full items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                myReaction ? "text-navy-600" : "text-gray-600 hover:bg-gray-50"
              }`
        }
      >
        {variant === "compact" ? (
          myReaction ?? "React"
        ) : (
          <>
            {myReaction ? (
              <span className="text-base leading-none">{myReaction}</span>
            ) : (
              <SmilePlus className="w-4 h-4" />
            )}
            <span>{myReaction ? EMOJIS.find((e) => e.emoji === myReaction)?.label ?? "Reacted" : "React"}</span>
          </>
        )}
      </button>
    </div>
  );
}
