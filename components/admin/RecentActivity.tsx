import Link from "next/link";
import { ActionBadge } from "@/components/admin/ActionBadge";
import { timeAgo } from "@/lib/helpers/timeAgo";
import { ROLE_LABEL } from "@/lib/constants/roles";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  afterState: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
  actor: { id: string; displayName: string; avatarUrl: string | null; role: string };
};

// Same summary logic as the Audit Log page (app/admin/audit/page.tsx), kept
// read-only and non-expandable here — Overview is a pulse, not the full record.
function summaryLine(entry: AuditEntry): string {
  const after = entry.afterState ?? {};
  const before = entry.beforeState ?? {};
  const parts: string[] = [];

  if (after.toUserName) parts.push(`To ${String(after.toUserName)}`);
  if (after.amount) parts.push(`${entry.action.includes("DEDUCT") ? "−" : "+"}${Number(after.amount).toLocaleString()} pts`);
  if (after.count) parts.push(`${String(after.count)} employees`);
  if (after.role) parts.push(`Role → ${ROLE_LABEL[String(after.role)] ?? String(after.role).replace(/_/g, " ")}`);
  if (before.content) {
    const text = String(before.content);
    parts.push(`"${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`);
  }
  if (parts.length === 0) return entry.entityType;
  return parts.join(" · ");
}

export function RecentActivity({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <p className="font-semibold text-gray-900 text-sm">Recent Admin Activity</p>
      </div>

      {entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">No recent activity</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                {entry.actor.avatarUrl
                  ? <img src={entry.actor.avatarUrl} alt={entry.actor.displayName} className="w-full h-full object-cover" />
                  : entry.actor.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{entry.actor.displayName}</span>
                  <ActionBadge action={entry.action} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{summaryLine(entry)}</p>
              </div>
              <span className="text-xs text-gray-500 shrink-0">{timeAgo(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-2.5 border-t border-gray-50">
        <Link href="/admin/audit" className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors">
          View full log →
        </Link>
      </div>
    </div>
  );
}
