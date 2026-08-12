"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

interface ListingOverflowMenuProps {
  onDelete: () => void;
  deleteDisabled: boolean;
  deleteDisabledReason?: string;
}

// A single-item overflow menu that exists mainly to keep "Delete listing"
// out of the primary action row — Edit/Close stay one tap away, Delete
// takes a deliberate extra step (see Food Board seller-dashboard spec, Step 19).
export function ListingOverflowMenu({ onDelete, deleteDisabled, deleteDisabledReason }: ListingOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More listing actions"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Listing actions"
          className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10"
        >
          <button
            role="menuitem"
            type="button"
            disabled={deleteDisabled}
            title={deleteDisabled ? deleteDisabledReason : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (deleteDisabled) return;
              setOpen(false);
              onDelete();
            }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              deleteDisabled
                ? "text-gray-300 cursor-not-allowed"
                : "text-red-500 hover:bg-red-50 hover:text-red-600"
            }`}
          >
            Delete listing
          </button>
          {deleteDisabled && (
            <p className="px-3 pt-0.5 pb-1.5 text-[11px] text-gray-400 leading-snug">{deleteDisabledReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
