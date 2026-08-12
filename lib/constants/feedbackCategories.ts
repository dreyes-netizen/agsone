// Single source of truth for whistleblower feedback category labels/colors —
// shared by the employee feedback page, both admin feedback views, and the
// admin overview's Action Queue (server-side), so a category always reads
// the same way and never leaks as a raw enum value.
export const CATEGORY_LABELS: Record<string, string> = {
  HARASSMENT_DISCRIMINATION: "Harassment & Discrimination",
  ETHICAL_FRAUD:             "Ethical Violations & Fraud",
  MISCONDUCT_ABUSE:          "Workplace Misconduct & Abuse of Authority",
  SECURITY_POLICY:           "Security Concerns & Policy Violations",
  COMPENSATION_BENEFITS: "Compensation & Benefits",
  WORK_LIFE_BALANCE: "Work-Life Balance",
  COMPANY_CULTURE: "Company Culture",
  TEAM_DYNAMICS: "Team Dynamics",
  PROCESSES_TOOLS: "Processes & Tools",
  RECOGNITION: "Recognition",
  OTHER: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  HARASSMENT_DISCRIMINATION: "bg-red-100 text-red-700",
  ETHICAL_FRAUD:             "bg-amber-100 text-amber-700",
  MISCONDUCT_ABUSE:          "bg-amber-100 text-amber-800",
  SECURITY_POLICY:           "bg-rose-100 text-rose-700",
  COMPENSATION_BENEFITS: "bg-emerald-100 text-emerald-700",
  WORK_LIFE_BALANCE: "bg-navy-100 text-navy-700",
  COMPANY_CULTURE: "bg-navy-200 text-navy-800",
  TEAM_DYNAMICS: "bg-amber-100 text-amber-700",
  PROCESSES_TOOLS: "bg-gray-100 text-gray-700",
  RECOGNITION: "bg-amber-100 text-amber-700",
  OTHER: "bg-gray-100 text-gray-600",
};
