"use client";

import { AlertTriangle, Clock, Paperclip } from "lucide-react";
import type { HrRequestType } from "@/lib/constants/hrRequests";

/**
 * The warning, turnaround note and attachment reminders for the selected
 * request type.
 *
 * The warning exists because resigned employees have no AGS One access at
 * all: final pay, clearance and BIR 2316 are only reachable here while still
 * employed, so someone serving their notice period needs to be told to file
 * before that access disappears.
 *
 * The attachment list exists because Gmail's compose URL cannot carry files —
 * the draft opens with the message filled in but nothing attached, and a COE or
 * a reimbursement claim that arrives without its supporting document just
 * bounces back. Saying so before the employee sends is the whole point.
 */
export function HrRequestGuidance({ type }: { type: HrRequestType }) {
  const attachments = type.attachments ?? [];
  if (!type.warning && !type.turnaround && attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      {type.warning && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="flex items-start gap-2 text-xs font-medium text-red-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{type.warning}</span>
          </p>
        </div>
      )}

      {type.turnaround && (
        <p className="flex items-start gap-2 text-xs text-gray-600">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
          <span>{type.turnaround}</span>
        </p>
      )}

      {attachments.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium text-amber-900">
            <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Attach these in Gmail before sending
          </p>
          <ul className="mt-1.5 ml-5 list-disc space-y-0.5 text-xs text-amber-800">
            {attachments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
