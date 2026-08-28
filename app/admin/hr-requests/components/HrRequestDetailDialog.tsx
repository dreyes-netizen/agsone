"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildGmailComposeUrl } from "@/lib/email/gmailCompose";
import { findHrRequestType } from "@/lib/constants/hrRequests";
import {
  ALL_HR_REQUEST_STATUSES,
  HR_REQUEST_STATUS_LABEL,
} from "@/lib/constants/hrRequestStatus";
import type { AdminHrRequest } from "../types";

/**
 * Renders the answers using the catalog for labels, but falls back to the raw
 * stored key when a field has since been retired — a row filed under an older
 * catalog must stay readable rather than render as blanks.
 */
function fieldRows(request: AdminHrRequest): { label: string; value: string }[] {
  const type = findHrRequestType(request.typeId);
  const entries = Object.entries(request.fields ?? {});
  if (!type) return entries.map(([key, value]) => ({ label: key, value }));

  const ordered: { label: string; value: string }[] = [];
  for (const field of type.fields) {
    const value = request.fields?.[field.id];
    if (!value) continue;
    const display =
      field.kind === "select"
        ? (field.options?.find((o) => o.value === value)?.label ?? value)
        : value;
    ordered.push({ label: field.label, value: display });
  }
  // Anything stored that the current catalog no longer knows about.
  for (const [key, value] of entries) {
    if (!type.fields.some((f) => f.id === key)) ordered.push({ label: key, value });
  }
  return ordered;
}

/**
 * The caller mounts this with `key={request.id}`, so opening a different
 * request remounts and the note box re-seeds from that row rather than
 * carrying the previous employee's text over.
 */
export function HrRequestDetailDialog({
  request,
  onClose,
  onUpdate,
  saving,
}: {
  request: AdminHrRequest;
  onClose: () => void;
  onUpdate: (id: string, status: AdminHrRequest["status"], adminNote: string) => void;
  saving: boolean;
}) {
  const [adminNote, setAdminNote] = useState(request.adminNote ?? "");

  const type = findHrRequestType(request.typeId);
  const rows = fieldRows(request);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type?.label ?? request.tag}</DialogTitle>
          <DialogDescription>
            {request.user.displayName}
            {request.user.employeeId ? ` (${request.user.employeeId})` : ""}
            {request.user.department ? ` · ${request.user.department.name}` : ""}
            {" · Ref "}
            {request.clientRef}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Request details
            </h3>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">No structured answers were submitted.</p>
            ) : (
              <dl className="space-y-1.5">
                {rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-3 gap-2 text-sm">
                    <dt className="text-gray-500 col-span-1">{row.label}</dt>
                    <dd className="text-gray-900 col-span-2">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {request.notes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Additional notes
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Email as sent
            </h3>
            <pre className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-52 overflow-y-auto">
              {request.subject}
              {"\n\n"}
              {request.body}
            </pre>
          </div>

          <div className="border-t border-table-border pt-4 space-y-3">
            <div>
              <label
                htmlFor="hr-admin-note"
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
              >
                Note to the employee
                <span className="float-right font-normal normal-case tracking-normal text-gray-500">
                  {adminNote.length}/500
                </span>
              </label>
              <textarea
                id="hr-admin-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Optional — shown on their My requests list"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ALL_HR_REQUEST_STATUSES.filter((s) => s !== request.status).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={saving}
                  onClick={() => onUpdate(request.id, status, adminNote)}
                  className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  Mark {HR_REQUEST_STATUS_LABEL[status]}
                </button>
              ))}

              <a
                href={buildGmailComposeUrl({
                  to: request.user.email,
                  subject: `Re: ${request.subject}`,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Reply in Gmail
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
