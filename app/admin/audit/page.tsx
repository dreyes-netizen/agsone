"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; displayName: string; avatarUrl: string | null; role: string };
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  DELETE_POST:       { label: "Delete Post",       color: "bg-red-100 text-red-700" },
  DELETE_COMMENT:    { label: "Delete Comment",     color: "bg-red-100 text-red-700" },
  UPDATE_ROLE:       { label: "Role Change",        color: "bg-violet-100 text-violet-700" },
  AWARD_POINTS:      { label: "Award Points",       color: "bg-emerald-100 text-emerald-700" },
  BULK_AWARD_POINTS: { label: "Bulk Award Points",  color: "bg-emerald-100 text-emerald-700" },
  ATTENDANCE_AWARD:  { label: "Attendance Award",   color: "bg-blue-100 text-blue-700" },
  DEDUCT_POINTS:     { label: "Deduct Points",      color: "bg-orange-100 text-orange-700" },
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action];
  if (!meta) return <span className="text-xs font-mono text-gray-500">{action}</span>;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
      {meta.label}
    </span>
  );
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
    if (after.toUserName) rows.push({ label: "Recipient", value: String(after.toUserName) });
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
    if (Array.isArray(after.notFound) && after.notFound.length > 0) {
      rows.push({ label: "Not Found IDs", value: (after.notFound as string[]).join(", ") });
    }
  } else if (action === "DEDUCT_POINTS") {
    if (after.toUserName) rows.push({ label: "Employee", value: String(after.toUserName) });
    if (after.deducted) rows.push({ label: "Points Deducted", value: `${Number(after.deducted).toLocaleString()} pts` });
    if (after.violationType) rows.push({ label: "Violation", value: String(after.violationType).replace(/_/g, " ") });
    if (after.reason) rows.push({ label: "Reason", value: String(after.reason) });
    if (after.newBalance !== undefined) rows.push({ label: "New Balance", value: `${Number(after.newBalance).toLocaleString()} pts` });
  } else if (action === "UPDATE_ROLE") {
    if (after.role) rows.push({ label: "New Role", value: String(after.role).replace(/_/g, " ") });
  } else if (action === "DELETE_POST" || action === "DELETE_COMMENT") {
    if (before.content) rows.push({ label: "Content", value: String(before.content) });
    if (before.authorId) rows.push({ label: "Author ID", value: String(before.authorId).slice(0, 8) + "…" });
    if (before.type) rows.push({ label: "Post Type", value: String(before.type) });
  } else {
    // Fallback: show all non-null after/before fields
    for (const [k, v] of Object.entries(after)) {
      if (v !== null && v !== undefined && k !== "toUserId" && k !== "recipientIds") {
        rows.push({ label: k.replace(/([A-Z])/g, " $1").trim(), value: String(v) });
      }
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 space-y-1.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex gap-2 text-xs">
          <span className="text-gray-400 font-medium shrink-0 w-28">{label}</span>
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAction]);

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
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
        >
          <option value="">All Actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{total.toLocaleString()} entries</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShieldAlert className="w-8 h-8 text-gray-300" />
            <p className="text-gray-400 text-sm">No audit entries found</p>
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {entry.actor.avatarUrl
                        ? <img src={entry.actor.avatarUrl} alt={entry.actor.displayName} className="w-full h-full object-cover" />
                        : entry.actor.displayName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{entry.actor.displayName}</span>
                        <ActionBadge action={entry.action} />
                        <span className="text-xs text-gray-400 ml-auto shrink-0">
                          {new Date(entry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Summary line */}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {entry.afterState?.toUserName && (
                          <>To <span className="font-medium text-gray-700">{String(entry.afterState.toUserName)}</span> · </>
                        )}
                        {entry.afterState?.amount && (
                          <span className="font-medium text-emerald-600">{entry.action.includes("DEDUCT") ? "−" : "+"}{Number(entry.afterState.amount).toLocaleString()} pts</span>
                        )}
                        {entry.afterState?.count && !entry.afterState?.amount && (
                          <>{String(entry.afterState.count)} employees</>
                        )}
                        {entry.afterState?.count && entry.afterState?.amount && (
                          <> · {String(entry.afterState.count)} employees</>
                        )}
                        {entry.afterState?.role && (
                          <> · Role → <span className="font-medium text-gray-700">{String(entry.afterState.role).replace(/_/g, " ")}</span></>
                        )}
                        {entry.beforeState?.content && (
                          <> · &quot;{String(entry.beforeState.content).slice(0, 50)}{String(entry.beforeState.content).length > 50 ? "…" : ""}&quot;</>
                        )}
                        {!entry.afterState?.toUserName && !entry.afterState?.amount && !entry.afterState?.count && !entry.afterState?.role && !entry.beforeState?.content && (
                          <span className="text-gray-400">{entry.entityType}</span>
                        )}
                      </p>

                      {/* Expand/collapse */}
                      {hasDetails && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : entry.id)}
                          className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 mt-1 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "Hide details" : "Show details"}
                        </button>
                      )}

                      {isExpanded && (
                        <AuditDetails
                          action={entry.action}
                          afterState={entry.afterState}
                          beforeState={entry.beforeState}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
