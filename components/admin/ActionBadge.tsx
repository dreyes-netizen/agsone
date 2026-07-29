import { ACTION_LABELS } from "@/lib/constants/auditActions";

// Shared between the Audit Log page and the admin overview's Recent Admin
// Activity panel so an action always renders identically in both places.
export function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action];
  if (!meta) return <span className="text-xs font-mono text-gray-500">{action}</span>;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
      {meta.label}
    </span>
  );
}
