// Single source of truth for Role display — shared by profile, employee
// detail, the command palette, and the admin employee editor so a role
// renders identically (and distinguishably) everywhere it's shown.
export const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE:    "Employee",
  MANAGER:     "Manager",
  HR_ADMIN:    "HR Admin",
  SUPER_ADMIN: "Super Admin",
};

export const ROLE_BADGE_CLASS: Record<string, string> = {
  EMPLOYEE:    "bg-gray-100 text-gray-600",
  MANAGER:     "bg-navy-100 text-navy-700",
  HR_ADMIN:    "bg-amber-100 text-amber-700",
  SUPER_ADMIN: "bg-red-100 text-red-700",
};
