"use client";

import { Info } from "lucide-react";
import { HR_HANDLED_ELSEWHERE } from "@/lib/constants/hrRequests";

/**
 * A standing notice for requests AGS One deliberately doesn't take — leave,
 * attendance, shift changes and payslip copies belong to Sprout or the team
 * lead. Placed above the picker rather than behind a category choice: the
 * failure mode being prevented is someone hunting for "Leave", not finding
 * it, and using General HR Question to email HR about it anyway — the exact
 * round-trip this feature exists to eliminate. It has to be visible before
 * they start searching, not after.
 */
export function HandledElsewhere() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
      <p className="flex items-center gap-2 text-xs font-medium text-blue-900">
        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        A few things aren&apos;t filed here
      </p>
      <ul className="mt-1.5 ml-5 list-disc space-y-0.5 text-xs text-blue-800">
        {HR_HANDLED_ELSEWHERE.map((item) => (
          <li key={item.what}>
            {item.what} — through {item.where}
          </li>
        ))}
      </ul>
    </div>
  );
}
