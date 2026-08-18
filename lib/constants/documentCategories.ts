// Single source of truth for HR document category labels/colors — shared by
// the employee Documents page and the admin HR Documents manager.
export const DOCUMENT_CATEGORY_LABEL: Record<string, string> = {
  HANDBOOK: "Handbook",
  POLICY:   "Policy",
  MEMO:     "Memo",
  OTHER:    "Other",
};

export const DOCUMENT_CATEGORY_BADGE: Record<string, string> = {
  HANDBOOK: "bg-navy-100 text-navy-700",
  POLICY:   "bg-blue-100 text-blue-700",
  MEMO:     "bg-amber-100 text-amber-700",
  OTHER:    "bg-gray-100 text-gray-700",
};

export const ALL_DOCUMENT_CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABEL);
