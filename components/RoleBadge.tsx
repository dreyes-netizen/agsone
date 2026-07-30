import { ROLE_LABEL, ROLE_BADGE_CLASS } from "@/lib/constants/roles";

// Shared between profile, employee detail, the command palette, and the
// admin employee editor so every role renders identically.
export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const badgeClass = ROLE_BADGE_CLASS[role] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass} ${className ?? ""}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}
