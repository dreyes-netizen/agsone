// Single source of truth for redemption status labels/colors — shared by the
// employee marketplace and the admin redemptions queue so a redemption reads
// the same way no matter who's looking at it.
export const REDEMPTION_STATUS_LABEL: Record<string, string> = {
  PENDING:   "Pending",
  APPROVED:  "Approved",
  REJECTED:  "Rejected",
  FULFILLED: "Fulfilled",
};

export const REDEMPTION_STATUS_BADGE: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  APPROVED:  "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-red-100 text-red-700",
  FULFILLED: "bg-blue-100 text-blue-700",
};
