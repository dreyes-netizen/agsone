"use client";

import { Building2 } from "lucide-react";
import type { AccountEntity, AccountTagInput } from "@/lib/hooks/useAccountTagInput";

/**
 * The #account autocomplete list, positioned above the composer it belongs
 * to. Mirrors MentionDropdown.tsx exactly -- see that file's doc comment for
 * why onMouseDown (not onClick) and why a listbox role with keyboard nav.
 */
export function AccountTagDropdown({
  accountTag,
  onSelect,
  className,
}: {
  accountTag: AccountTagInput;
  onSelect: (acct: AccountEntity) => void;
  className?: string;
}) {
  if (!accountTag.open) return null;

  return (
    <ul
      role="listbox"
      aria-label="Tag an account"
      className={
        className ??
        "absolute bottom-full left-0 mb-1 z-30 w-64 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
      }
    >
      {accountTag.results.map((acct, i) => (
        <li key={acct.id}>
          <button
            type="button"
            role="option"
            aria-selected={i === accountTag.activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(acct);
            }}
            onMouseEnter={() => accountTag.setActiveIndex(i)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              i === accountTag.activeIndex ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Building2 className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            <span className="truncate">{acct.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
