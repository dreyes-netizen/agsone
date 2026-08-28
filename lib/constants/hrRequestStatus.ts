// Single source of truth for HR request status labels and colors — shared by
// the employee's "My requests" list and the admin HR Requests queue.
export const HR_REQUEST_STATUS_LABEL: Record<string, string> = {
  NEW:         "New",
  IN_PROGRESS: "In Progress",
  DONE:        "Done",
};

export const HR_REQUEST_STATUS_BADGE: Record<string, string> = {
  NEW:         "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE:        "bg-emerald-100 text-emerald-700",
};

export const ALL_HR_REQUEST_STATUSES = Object.keys(HR_REQUEST_STATUS_LABEL) as [
  "NEW",
  "IN_PROGRESS",
  "DONE",
];
