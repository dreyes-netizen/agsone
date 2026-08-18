// Audit action display metadata — single source of truth shared by the
// Audit Log page and the admin overview's Recent Admin Activity panel.
//
// Which actions get logged at all (and which are deliberately skipped) is
// decided by one rule: log an action if it's irreversible, moves points,
// changes who can do what, or is a decision made about a named person.
// Skip content authoring/curation whose current state the app already shows
// elsewhere (department/document CRUD, medicine catalog edits, feedback
// replies) — logging those would flood this panel for near-zero signal.
export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  // People & access
  UPDATE_ROLE:              { label: "Role Change",         color: "bg-navy-100 text-navy-700" },
  CREATE_USER:               { label: "Add Employee",        color: "bg-navy-50 text-navy-700" },
  UPDATE_USER:                { label: "Edit Employee",       color: "bg-gray-100 text-gray-700" },
  SYNC_EMPLOYEES:            { label: "Employee Sync",       color: "bg-blue-100 text-blue-700" },
  ORG_CHART_REPLACE:         { label: "Org Chart Replacement", color: "bg-navy-100 text-navy-700" },

  // Points
  AWARD_POINTS:              { label: "Award Points",        color: "bg-emerald-100 text-emerald-700" },
  BULK_AWARD_POINTS:         { label: "Bulk Award Points",   color: "bg-emerald-100 text-emerald-700" },
  ATTENDANCE_AWARD:          { label: "Attendance Award",    color: "bg-blue-100 text-blue-700" },
  DEDUCT_POINTS:             { label: "Deduct Points",       color: "bg-orange-100 text-orange-700" },

  // Marketplace
  CREATE_REWARD:             { label: "Add Reward",          color: "bg-emerald-50 text-emerald-700" },
  UPDATE_REWARD:             { label: "Edit Reward",         color: "bg-gray-100 text-gray-700" },
  DELETE_REWARD:             { label: "Hide Reward",         color: "bg-orange-100 text-orange-700" },
  HARD_DELETE_REWARD:        { label: "Permanently Delete Reward", color: "bg-red-100 text-red-700" },
  REDEMPTION_STATUS:         { label: "Redemption Decision", color: "bg-amber-100 text-amber-700" },

  // Medicine
  MEDICINE_REQUEST_STATUS:  { label: "Medicine Decision",   color: "bg-amber-100 text-amber-700" },

  // Content
  DELETE_POST:               { label: "Delete Post",         color: "bg-red-100 text-red-700" },
  DELETE_COMMENT:            { label: "Delete Comment",      color: "bg-red-100 text-red-700" },

  // System
  UPDATE_FEEDBACK_STATUS:    { label: "Feedback Status",     color: "bg-slate-100 text-slate-700" },
  UPDATE_SETTING:            { label: "Update Setting",      color: "bg-slate-100 text-slate-700" },
};

export const ALL_ACTIONS = Object.keys(ACTION_LABELS);
