// Audit action display metadata — single source of truth shared by the
// Audit Log page and the admin overview's Recent Admin Activity panel.
export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  DELETE_POST:       { label: "Delete Post",       color: "bg-red-100 text-red-700" },
  DELETE_COMMENT:    { label: "Delete Comment",     color: "bg-red-100 text-red-700" },
  UPDATE_ROLE:       { label: "Role Change",        color: "bg-navy-100 text-navy-700" },
  AWARD_POINTS:      { label: "Award Points",       color: "bg-emerald-100 text-emerald-700" },
  BULK_AWARD_POINTS: { label: "Bulk Award Points",  color: "bg-emerald-100 text-emerald-700" },
  ATTENDANCE_AWARD:  { label: "Attendance Award",   color: "bg-blue-100 text-blue-700" },
  DEDUCT_POINTS:     { label: "Deduct Points",      color: "bg-orange-100 text-orange-700" },
  UPDATE_SETTING:    { label: "Update Setting",     color: "bg-slate-100 text-slate-700" },
  HARD_DELETE_REWARD: { label: "Permanently Delete Reward", color: "bg-red-100 text-red-700" },
};

export const ALL_ACTIONS = Object.keys(ACTION_LABELS);
