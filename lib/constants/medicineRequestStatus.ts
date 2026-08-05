// Single source of truth for medicine request status colors — shared by the
// employee medicine board and the admin medicine requests queue.
export const MEDICINE_REQUEST_STATUS_BADGE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
};
