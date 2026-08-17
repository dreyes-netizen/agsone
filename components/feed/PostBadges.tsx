"use client";

import { Building2, BarChart2, EyeOff } from "lucide-react";
import { flairById } from "@/lib/flairs";

/**
 * Post category/audience chips — flair, poll, department-only.
 * The composer's flair picker keeps each flair's own color (useful when
 * choosing between 15 options), but on the feed itself every chip here
 * renders in one restrained neutral style so a Team post's badge never
 * outweighs the author name or the content beneath it.
 */
export function PostBadges({
  flairId,
  isPoll,
  isAnonymousPoll,
  departmentName,
}: {
  flairId?: string | null;
  isPoll?: boolean;
  isAnonymousPoll?: boolean;
  departmentName?: string | null;
}) {
  const flair = flairById[flairId ?? "CASUAL"] ?? flairById.CASUAL;

  return (
    <div className="flex items-center gap-1.5 mt-2 mb-1 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
        <span aria-hidden="true">{flair.emoji}</span>
        {flair.label}
      </span>
      {isPoll && (
        isAnonymousPoll ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            <EyeOff className="w-3 h-3" aria-hidden="true" /> Anonymous Poll
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            <BarChart2 className="w-3 h-3" aria-hidden="true" /> Poll
          </span>
        )
      )}
      {departmentName && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          <Building2 className="w-3 h-3" aria-hidden="true" /> {departmentName} only
        </span>
      )}
    </div>
  );
}
