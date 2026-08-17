import { ROLE_LABEL } from "@/lib/constants/roles";
import { VIOLATION_TYPES } from "@/lib/constants/awardActivities";
import { REDEMPTION_STATUS_LABEL } from "@/lib/constants/redemptionStatus";
import { CATEGORY_LABELS } from "@/lib/constants/feedbackCategories";

// Single source of truth for turning an AuditLog row into a readable
// sentence. Previously this logic was duplicated — once as a string builder
// in components/admin/RecentActivity.tsx, once as inline JSX in
// app/admin/audit/page.tsx — and the two had already drifted (the "−" sign
// for DEDUCT_POINTS was dead code in both, since the writer stores
// `deducted`, not `amount`). Both call sites now render from this one
// formatter instead.
//
// A row renders as a sequence of "groups" (each group is one or more
// adjacent segments sharing no separator, e.g. a label + an emphasized
// value) joined by " · ". Consumers just concatenate `segments.map(s =>
// s.text)` for a plain string, or map to <span>s using `emphasis`/`tone`.

export type AuditSegment = { text: string; emphasis?: boolean; tone?: "positive" | "negative" };

export type AuditEntryLike = {
  action: string;
  entityType: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
};

type Group = AuditSegment[];

function roleLabel(role: unknown): string {
  const r = String(role);
  return ROLE_LABEL[r] ?? r.replace(/_/g, " ");
}

function violationLabel(violationType: unknown): string {
  const key = String(violationType);
  return VIOLATION_TYPES.find((v) => v.key === key)?.label ?? key.replace(/_/g, " ");
}

function redemptionStatusLabel(status: unknown): string {
  const s = String(status);
  return REDEMPTION_STATUS_LABEL[s] ?? s.replace(/_/g, " ");
}

function feedbackCategoryLabel(category: unknown): string {
  const c = String(category);
  return CATEGORY_LABELS[c] ?? c.replace(/_/g, " ");
}

// Generic status-key label for domains with no shared constant (medicine
// request status) — "REJECTED" -> "Rejected".
function titleCase(value: unknown): string {
  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function truncate(text: string, max = 50): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Affected person's name. New rows carry it directly (targetUserName,
// captured at write time by writeAuditLog()); older rows only had
// `toUserName`, and the oldest had neither — resolveAuditNames.ts fills
// those in at read time before this formatter ever sees the entry.
function targetName(after: Record<string, unknown>): string | null {
  const name = after.targetUserName ?? after.toUserName;
  return name ? String(name) : null;
}

function flattenGroups(groups: Group[]): AuditSegment[] {
  const nonEmpty = groups.filter((g) => g.length > 0);
  const result: AuditSegment[] = [];
  nonEmpty.forEach((g, i) => {
    if (i > 0) result.push({ text: " · " });
    result.push(...g);
  });
  return result;
}

type Formatter = (after: Record<string, unknown>, before: Record<string, unknown>) => Group[];

const FORMATTERS: Record<string, Formatter> = {
  UPDATE_ROLE: (after, before) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: name, emphasis: true }]);

    const afterRole = after.role;
    const beforeRole = before.role;
    if (afterRole) {
      if (beforeRole && beforeRole !== afterRole) {
        groups.push([{ text: `${roleLabel(beforeRole)} → ` }, { text: roleLabel(afterRole), emphasis: true }]);
      } else {
        groups.push([{ text: "Role → " }, { text: roleLabel(afterRole), emphasis: true }]);
      }
    }
    return groups;
  },

  UPDATE_USER: (after) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: name, emphasis: true }]);

    const changes = (after.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
    if (changes.isActive) {
      const activated = changes.isActive.to === true;
      groups.push([{ text: activated ? "Activated" : "Deactivated", emphasis: true, tone: activated ? "positive" : "negative" }]);
    }
    if (changes.role) {
      groups.push([{ text: `Role: ${roleLabel(changes.role.from)} → ` }, { text: roleLabel(changes.role.to), emphasis: true }]);
    }
    if (changes.departmentName) {
      groups.push([{ text: `Dept: ${changes.departmentName.from ?? "—"} → ${changes.departmentName.to ?? "—"}` }]);
    }
    if (changes.displayName) {
      groups.push([{ text: `Renamed from "${changes.displayName.from}"` }]);
    }
    if (changes.email) {
      groups.push([{ text: "Email updated" }]);
    }
    return groups;
  },

  CREATE_USER: (after) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: name, emphasis: true }]);
    if (after.role) groups.push([{ text: `Added as ${roleLabel(after.role)}` }]);
    return groups;
  },

  AWARD_POINTS: (after) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: "To " }, { text: name, emphasis: true }]);
    if (after.amount) groups.push([{ text: `+${Number(after.amount).toLocaleString()} pts`, tone: "positive" }]);
    if (after.note) groups.push([{ text: `"${truncate(String(after.note))}"` }]);
    return groups;
  },

  DEDUCT_POINTS: (after) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: name, emphasis: true }]);
    const amount = after.deducted ?? after.amount;
    if (amount) groups.push([{ text: `−${Number(amount).toLocaleString()} pts`, tone: "negative" }]);
    if (after.violationType) groups.push([{ text: violationLabel(after.violationType) }]);
    return groups;
  },

  BULK_AWARD_POINTS: (after) => {
    const groups: Group[] = [];
    if (after.count) groups.push([{ text: `${after.count} employees`, emphasis: true }]);
    if (after.amount) groups.push([{ text: `+${Number(after.amount).toLocaleString()} pts each`, tone: "positive" }]);
    return groups;
  },

  ATTENDANCE_AWARD: (after) => {
    const groups: Group[] = [];
    if (after.count) groups.push([{ text: `${after.count} employees`, emphasis: true }]);
    if (after.amount) groups.push([{ text: `+${Number(after.amount).toLocaleString()} pts`, tone: "positive" }]);
    if (after.attendanceMonth) {
      const d = new Date(String(after.attendanceMonth));
      if (!Number.isNaN(d.getTime())) {
        groups.push([{ text: d.toLocaleString("en-US", { month: "long", year: "numeric" }) }]);
      }
    }
    return groups;
  },

  REDEMPTION_STATUS: (after) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: name, emphasis: true }]);
    if (after.rewardName) groups.push([{ text: String(after.rewardName) }]);
    if (after.toStatus) {
      const toStatus = String(after.toStatus);
      const tone: AuditSegment["tone"] = toStatus === "REJECTED" ? "negative" : toStatus === "APPROVED" || toStatus === "FULFILLED" ? "positive" : undefined;
      if (after.fromStatus) {
        groups.push([{ text: `${redemptionStatusLabel(after.fromStatus)} → ` }, { text: redemptionStatusLabel(toStatus), emphasis: true, tone }]);
      } else {
        groups.push([{ text: redemptionStatusLabel(toStatus), emphasis: true, tone }]);
      }
    }
    if (after.refunded) groups.push([{ text: `(${Number(after.refunded).toLocaleString()} pts refunded)` }]);
    return groups;
  },

  MEDICINE_REQUEST_STATUS: (after) => {
    const groups: Group[] = [];
    const name = targetName(after);
    if (name) groups.push([{ text: name, emphasis: true }]);
    if (after.medicineName) {
      const qty = after.quantity ? ` ×${after.quantity}` : "";
      groups.push([{ text: `${String(after.medicineName)}${qty}` }]);
    }
    if (after.toStatus) {
      const toStatus = String(after.toStatus);
      const tone: AuditSegment["tone"] = toStatus === "REJECTED" ? "negative" : toStatus === "APPROVED" ? "positive" : undefined;
      groups.push([{ text: titleCase(toStatus), emphasis: true, tone }]);
    }
    return groups;
  },

  CREATE_REWARD: (after) => {
    const groups: Group[] = [];
    if (after.name) groups.push([{ text: String(after.name), emphasis: true }]);
    if (after.pointCost) groups.push([{ text: `${Number(after.pointCost).toLocaleString()} pts` }]);
    return groups;
  },

  UPDATE_REWARD: (after) => {
    const groups: Group[] = [];
    if (after.name) groups.push([{ text: String(after.name), emphasis: true }]);
    const changes = (after.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
    if (changes.pointCost) groups.push([{ text: `${changes.pointCost.from} → ${changes.pointCost.to} pts` }]);
    if (changes.stockQuantity) groups.push([{ text: `Stock: ${changes.stockQuantity.from} → ${changes.stockQuantity.to}` }]);
    if (changes.isActive) {
      const active = changes.isActive.to === true;
      groups.push([{ text: active ? "Reactivated" : "Deactivated", tone: active ? "positive" : "negative" }]);
    }
    return groups;
  },

  DELETE_REWARD: (after) => {
    const groups: Group[] = [];
    if (after.name) groups.push([{ text: String(after.name), emphasis: true }]);
    groups.push([{ text: "Deactivated", tone: "negative" }]);
    return groups;
  },

  HARD_DELETE_REWARD: (_after, before) => {
    const groups: Group[] = [];
    if (before.name) groups.push([{ text: String(before.name), emphasis: true }]);
    if (before.pointCost) groups.push([{ text: `${Number(before.pointCost).toLocaleString()} pts` }]);
    return groups;
  },

  UPDATE_FEEDBACK_STATUS: (after) => {
    const groups: Group[] = [];
    if (after.category) groups.push([{ text: feedbackCategoryLabel(after.category) }]);
    if (after.toStatus) {
      const toStatus = String(after.toStatus);
      const tone: AuditSegment["tone"] = toStatus === "RESOLVED" ? "positive" : toStatus === "DISMISSED" ? "negative" : undefined;
      if (after.fromStatus) {
        groups.push([{ text: `${titleCase(after.fromStatus)} → ` }, { text: titleCase(toStatus), emphasis: true, tone }]);
      } else {
        groups.push([{ text: titleCase(toStatus), emphasis: true, tone }]);
      }
    }
    return groups;
  },

  DELETE_POST: (_after, before) => {
    const groups: Group[] = [];
    const authorName = before.authorName;
    groups.push([{ text: "Post by " }, { text: authorName ? String(authorName) : "Unknown user", emphasis: true }]);
    if (before.content) groups.push([{ text: `"${truncate(String(before.content))}"` }]);
    return groups;
  },

  DELETE_COMMENT: (_after, before) => {
    const groups: Group[] = [];
    const authorName = before.authorName;
    groups.push([{ text: "Comment by " }, { text: authorName ? String(authorName) : "Unknown user", emphasis: true }]);
    if (before.content) groups.push([{ text: `"${truncate(String(before.content))}"` }]);
    return groups;
  },

  UPDATE_SETTING: (after) => {
    const groups: Group[] = [];
    if (after.allyEnabled !== undefined) {
      const enabled = after.allyEnabled === true;
      groups.push([{ text: "Ally assistant → " }, { text: enabled ? "Enabled" : "Disabled", emphasis: true, tone: enabled ? "positive" : "negative" }]);
    }
    return groups;
  },

  SYNC_EMPLOYEES: (after) => {
    const groups: Group[] = [];
    if (after.imported) groups.push([{ text: `${after.imported} imported`, tone: "positive" }]);
    if (after.deactivated) groups.push([{ text: `${after.deactivated} deactivated`, tone: "negative" }]);
    if (after.reactivated) groups.push([{ text: `${after.reactivated} reactivated`, tone: "positive" }]);
    if (after.failedImports) groups.push([{ text: `${after.failedImports} failed`, tone: "negative" }]);
    return groups;
  },
};

export function auditSummary(entry: AuditEntryLike): AuditSegment[] {
  const after = entry.afterState ?? {};
  const before = entry.beforeState ?? {};

  const formatter = FORMATTERS[entry.action];
  const groups = formatter ? formatter(after, before) : [];
  const segments = flattenGroups(groups);

  return segments.length > 0 ? segments : [{ text: entry.entityType }];
}
