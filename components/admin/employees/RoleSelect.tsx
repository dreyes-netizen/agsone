"use client";

// Single source of truth for the EMPLOYEE/MANAGER/HR_ADMIN/SUPER_ADMIN option
// list used by every role-assignment dropdown (mobile card, desktop table,
// Add Employee modal, Edit Employee modal) so the SUPER_ADMIN-option gating
// can't drift between call sites.
export function RoleSelect({
  value,
  onChange,
  isSuperAdmin,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  isSuperAdmin: boolean;
  disabled?: boolean;
  className: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value="EMPLOYEE">Employee</option>
      <option value="MANAGER">Manager</option>
      <option value="HR_ADMIN">HR Admin</option>
      {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
    </select>
  );
}
