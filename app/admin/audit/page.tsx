"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { ShieldAlert, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { ACTION_LABELS, ALL_ACTIONS } from "@/lib/constants/auditActions";
import { ActionBadge } from "@/components/admin/ActionBadge";
import { ROLE_LABEL } from "@/lib/constants/roles";
import { VIOLATION_TYPES } from "@/lib/constants/awardActivities";
import { auditSummary, type AuditEntryLike } from "@/lib/helpers/auditSummary";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

function violationLabel(violationType: string): string {
  return VIOLATION_TYPES.find((v) => v.key === violationType)?.label
    ?? violationType.replace(/_/g, " ");
}

type AuditEntry = AuditEntryLike & {
  id: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; displayName: string; avatarUrl: string | null; role: string };
};

const TONE_CLASS: Record<string, string> = {
  positive: "font-medium text-emerald-600",
  negative: "font-medium text-red-600",
};

function targetName(after: Record<string, unknown>): string | null {
  const name = after.targetUserName ?? after.toUserName;
  return name ? String(name) : null;
}

// Renders a { field: { from, to } } diff (UPDATE_USER, UPDATE_REWARD) as one
// row per changed field — "Role: Employee → Manager" instead of a raw
// stringified object, which is what a naive fallback would otherwise show.
function changeRows(changes: unknown): { label: string; value: string }[] {
  if (!changes || typeof changes !== "object") return [];
  const rows: { label: string; value: string }[] = [];
  for (const [field, diff] of Object.entries(changes as Record<string, { from: unknown; to: unknown }>)) {
    const label = field.replace(/([A-Z])/g, " $1").replace(/^\w/, (c) => c.toUpperCase()).trim();
    const from = field === "role" ? (ROLE_LABEL[String(diff.from)] ?? String(diff.from)) : String(diff.from ?? "—");
    const to = field === "role" ? (ROLE_LABEL[String(diff.to)] ?? String(diff.to)) : String(diff.to ?? "—");
    rows.push({ label, value: `${from} → ${to}` });
  }
  return rows;
}

function AuditDetails({ action, afterState, beforeState }: {
  action: string;
  afterState: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
}) {
  const after = afterState ?? {};
  const before = beforeState ?? {};

  const rows: { label: string; value: string }[] = [];

  if (action === "AWARD_POINTS") {
    const name = targetName(after);
    if (name) rows.push({ label: "Recipient", value: name });
    if (after.amount) rows.push({ label: "Points Awarded", value: `${Number(after.amount).toLocaleString()} pts` });
    if (after.note) rows.push({ label: "Note", value: String(after.note) });
  } else if (action === "BULK_AWARD_POINTS") {
    if (after.count) rows.push({ label: "Recipients", value: `${after.count} employees` });
    if (after.amount) rows.push({ label: "Points Each", value: `${Number(after.amount).toLocaleString()} pts` });
    if (after.note) rows.push({ label: "Note", value: String(after.note) });
    if (Array.isArray(after.recipientNames) && after.recipientNames.length > 0) {
      rows.push({ label: "Employees", value: (after.recipientNames as string[]).join(", ") });
    }
  } else if (action === "ATTENDANCE_AWARD") {
    if (after.count) rows.push({ label: "Recipients", value: `${after.count} employees` });
    if (after.attendanceMonth) {
      const d = new Date(String(after.attendanceMonth));
      rows.push({ label: "Period", value: d.toLocaleString("en-US", { month: "long", year: "numeric" }) });
    }
    if (Array.isArray(after.recipientNames) && after.recipientNames.length > 0) {
      rows.push({ label: "Employees", value: (after.recipientNames as string[]).join(", ") });
    }
    if (Array.isArray(after.notFound) && after.notFound.length > 0) {
      rows.push({ label: "Not Found IDs", value: (after.notFound as string[]).join(", ") });
    }
  } else if (action === "DEDUCT_POINTS") {
    const name = targetName(after);
    if (name) rows.push({ label: "Employee", value: name });
    if (after.deducted) rows.push({ label: "Points Deducted", value: `${Number(after.deducted).toLocaleString()} pts` });
    if (after.violationType) rows.push({ label: "Violation", value: violationLabel(String(after.violationType)) });
    if (after.reason) rows.push({ label: "Reason", value: String(after.reason) });
    if (after.newBalance !== undefined) rows.push({ label: "New Balance", value: `${Number(after.newBalance).toLocaleString()} pts` });
  } else if (action === "UPDATE_ROLE") {
    const name = targetName(after);
    if (name) rows.push({ label: "Employee", value: name });
    if (before.role) rows.push({ label: "Previous Role", value: ROLE_LABEL[String(before.role)] ?? String(before.role).replace(/_/g, " ") });
    if (after.role) rows.push({ label: "New Role", value: ROLE_LABEL[String(after.role)] ?? String(after.role).replace(/_/g, " ") });
  } else if (action === "UPDATE_USER" || action === "UPDATE_REWARD") {
    const name = targetName(after) ?? (after.name ? String(after.name) : null);
    if (name) rows.push({ label: action === "UPDATE_USER" ? "Employee" : "Reward", value: name });
    rows.push(...changeRows(after.changes));
  } else if (action === "CREATE_USER") {
    const name = targetName(after);
    if (name) rows.push({ label: "Employee", value: name });
    if (after.role) rows.push({ label: "Role", value: ROLE_LABEL[String(after.role)] ?? String(after.role).replace(/_/g, " ") });
  } else if (action === "CREATE_REWARD" || action === "DELETE_REWARD") {
    if (after.name) rows.push({ label: "Reward", value: String(after.name) });
    if (after.pointCost) rows.push({ label: "Point Cost", value: `${Number(after.pointCost).toLocaleString()} pts` });
  } else if (action === "REDEMPTION_STATUS") {
    const name = targetName(after);
    if (name) rows.push({ label: "Employee", value: name });
    if (after.rewardName) rows.push({ label: "Reward", value: String(after.rewardName) });
    if (after.fromStatus) rows.push({ label: "Previous Status", value: String(after.fromStatus).replace(/_/g, " ") });
    if (after.toStatus) rows.push({ label: "New Status", value: String(after.toStatus).replace(/_/g, " ") });
    if (after.refunded) rows.push({ label: "Refunded", value: `${Number(after.refunded).toLocaleString()} pts` });
  } else if (action === "MEDICINE_REQUEST_STATUS") {
    const name = targetName(after);
    if (name) rows.push({ label: "Employee", value: name });
    if (after.medicineName) rows.push({ label: "Medicine", value: `${String(after.medicineName)}${after.quantity ? ` ×${after.quantity}` : ""}` });
    if (after.fromStatus) rows.push({ label: "Previous Status", value: String(after.fromStatus).replace(/_/g, " ") });
    if (after.toStatus) rows.push({ label: "New Status", value: String(after.toStatus).replace(/_/g, " ") });
  } else if (action === "UPDATE_FEEDBACK_STATUS") {
    // Whistleblower surface — deliberately never shows the reporter or content here.
    if (after.category) rows.push({ label: "Category", value: String(after.category).replace(/_/g, " ") });
    if (after.fromStatus) rows.push({ label: "Previous Status", value: String(after.fromStatus).replace(/_/g, " ") });
    if (after.toStatus) rows.push({ label: "New Status", value: String(after.toStatus).replace(/_/g, " ") });
  } else if (action === "SYNC_EMPLOYEES") {
    if (after.activeInFile !== undefined) rows.push({ label: "Active in File", value: String(after.activeInFile) });
    if (after.imported) rows.push({ label: "Imported", value: String(after.imported) });
    if (after.deactivated) rows.push({ label: "Deactivated", value: String(after.deactivated) });
    if (after.reactivated) rows.push({ label: "Reactivated", value: String(after.reactivated) });
    if (after.failedImports) rows.push({ label: "Failed", value: String(after.failedImports) });
  } else if (action === "UPDATE_SETTING") {
    if (before.allyEnabled !== undefined) rows.push({ label: "Previous", value: before.allyEnabled ? "Enabled" : "Disabled" });
    if (after.allyEnabled !== undefined) rows.push({ label: "New Value", value: after.allyEnabled ? "Enabled" : "Disabled" });
  } else if (action === "HARD_DELETE_REWARD") {
    if (before.name) rows.push({ label: "Reward", value: String(before.name) });
    if (before.pointCost) rows.push({ label: "Point Cost", value: `${Number(before.pointCost).toLocaleString()} pts` });
    if (before.stockQuantity !== undefined) rows.push({ label: "Stock", value: String(before.stockQuantity) });
  } else if (action === "DELETE_POST" || action === "DELETE_COMMENT") {
    if (before.content) rows.push({ label: "Content", value: String(before.content) });
    const authorName = before.authorName;
    rows.push({ label: "Author", value: authorName ? String(authorName) : `${String(before.authorId ?? "").slice(0, 8)}…` });
    if (before.type) rows.push({ label: "Post Type", value: String(before.type) });
  } else {
    // Fallback for any action without an explicit branch above — show every
    // non-null before/after field rather than silently rendering nothing.
    for (const [k, v] of Object.entries({ ...before, ...after })) {
      if (v !== null && v !== undefined && k !== "toUserId" && k !== "targetUserId" && k !== "recipientIds" && k !== "changes") {
        rows.push({ label: k.replace(/([A-Z])/g, " $1").trim(), value: String(v) });
      }
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 space-y-1.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex gap-2 text-xs">
          <span className="text-gray-500 font-medium shrink-0 w-28">{label}</span>
          <span className="text-gray-700 break-words min-w-0">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  const { apiFetch } = useApiClient();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filterAction) params.set("action", filterAction);
      const res = await apiFetch<{ data: AuditEntry[]; total: number; page: number; pages: number }>(
        `/api/admin/audit?${params}`
      );
      setEntries(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAction]);

  useRealtimeChannel(realtimeTopics.adminAudit, load, { debounceMs: 200 });

  function handleFilterChange(action: string) {
    setFilterAction(action);
    setPage(1);
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">
          Record of all administrative actions — role changes, point awards, content removals.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterAction}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30"
        >
          <option value="">All Actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{total.toLocaleString()} entries</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-card border border-table-border overflow-hidden">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-12 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShieldAlert className="w-8 h-8 text-gray-300" aria-hidden="true" />
            <p className="text-gray-500 text-sm">No audit entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map((entry) => {
              const isExpanded = expanded === entry.id;
              const hasDetails = entry.beforeState || entry.afterState;
              return (
                <div key={entry.id} className="px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Actor avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {entry.actor.avatarUrl
                        ? <img src={entry.actor.avatarUrl} alt={entry.actor.displayName} className="w-full h-full object-cover" />
                        : entry.actor.displayName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{entry.actor.displayName}</span>
                        <ActionBadge action={entry.action} />
                        <span className="text-xs text-gray-500 ml-auto shrink-0">
                          {new Date(entry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Summary line — same formatter as the Overview panel (lib/helpers/auditSummary.ts) */}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {auditSummary(entry).map((s, i) => (
                          <span key={i} className={s.emphasis ? "font-medium text-gray-700" : s.tone ? TONE_CLASS[s.tone] : undefined}>
                            {s.text}
                          </span>
                        ))}
                      </p>

                      {/* Expand/collapse */}
                      {hasDetails && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : entry.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`details-${entry.id}`}
                          className="flex items-center gap-1 text-[11px] text-navy-600 hover:text-navy-800 mt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 rounded"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" aria-hidden="true" /> : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
                          {isExpanded ? "Hide details" : "Show details"}
                        </button>
                      )}

                      {isExpanded && (
                        <div id={`details-${entry.id}`}>
                          <AuditDetails
                            action={entry.action}
                            afterState={entry.afterState}
                            beforeState={entry.beforeState}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}
