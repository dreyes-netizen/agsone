"use client";

import React, { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";

const EMOJIS = [
  { emoji: "👍", label: "Like" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "💪", label: "Strong" },
];

const EMOJI_BG: Record<string, string> = {
  "👍": "bg-navy-50 text-navy-700 border-navy-200",
  "❤️": "bg-rose-50 text-rose-600 border-rose-200",
  "🔥": "bg-amber-50 text-amber-600 border-amber-200",
  "👏": "bg-amber-50 text-amber-700 border-amber-200",
  "🎉": "bg-navy-50 text-navy-700 border-navy-200",
  "💪": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ReactionBar({
  postId,
  reactions,
  myReactions,
  onReact,
}: {
  postId: string;
  reactions: Record<string, number>;
  myReactions: string[];
  onReact: (postId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const myReaction = myReactions[0] ?? null;
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

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
      onReact(postId, myReaction); // toggle off
    } else {
      setPickerOpen((v) => !v);
    }
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (myReaction) {
        onReact(postId, myReaction);
      } else {
        setPickerOpen((v) => !v);
      }
    } else if (e.key === "Escape" && pickerOpen) {
      e.preventDefault();
      closePicker();
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* React button */}
      <div
        ref={containerRef}
        className="relative"
        onMouseEnter={openPicker}
        onMouseLeave={closePicker}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label="Add reaction"
      >
        {/* Floating picker — pb-2 bridges the gap so mouse doesn't leave container */}
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-20 pb-2">
            <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border border-gray-100 px-3 py-2.5" role="group" aria-label="Emoji reactions">
              {EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  title={label}
                  onClick={() => { onReact(postId, emoji); closePicker(); }}
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            myReaction
              ? "bg-navy-50 border-navy-200 text-navy-700"
              : "bg-white border-gray-200 text-gray-500 hover:border-navy-300 hover:text-navy-600"
          }`}
        >
          {myReaction ? (
            <span className="text-sm leading-none">{myReaction}</span>
          ) : (
            <SmilePlus className="w-3.5 h-3.5" />
          )}
          <span>{myReaction ? EMOJIS.find((e) => e.emoji === myReaction)?.label ?? "Reacted" : "Add reaction"}</span>
        </button>
      </div>

      {/* Reaction summary bubbles */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1.5">
          {Object.entries(reactions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([emoji, count]) => (
              <span
                key={emoji}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${EMOJI_BG[emoji] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
              >
                {emoji} {count}
              </span>
            ))}
          {totalReactions > 0 && (
            <span className="text-xs text-gray-500 font-medium ml-0.5">
              {totalReactions} {totalReactions === 1 ? "reaction" : "reactions"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
