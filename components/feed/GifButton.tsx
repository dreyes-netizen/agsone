"use client";

/**
 * Composer trigger for the GIF picker. A literal "GIF" label rather than an
 * icon glyph — matches how the feature reads to users and needs no icon-only
 * accessible-name workaround.
 */
export function GifButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Add a GIF"
      title={disabled ? "GIFs are unavailable right now" : "Add a GIF"}
      className="shrink-0 flex items-center justify-center px-2.5 h-8 rounded-xl border border-gray-200 text-[11px] font-bold tracking-wide text-gray-500 hover:bg-gray-50 hover:text-navy-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      GIF
    </button>
  );
}
