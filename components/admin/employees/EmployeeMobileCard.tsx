"use client";

import { Pencil } from "lucide-react";
import { RoleBadge } from "@/components/RoleBadge";
import { RoleSelect } from "@/components/admin/employees/RoleSelect";
import type { Employee } from "@/lib/hooks/useAdminEmployeesActions";

export function EmployeeMobileCard({
  employee,
  isOwnRow,
  isSuperAdmin,
  updatingId,
  onRoleChange,
  onEdit,
  formatDate,
}: {
  employee: Employee;
  isOwnRow: boolean;
  isSuperAdmin: boolean;
  updatingId: string | null;
  onRoleChange: (employeeId: string, role: string) => void;
  onEdit: (employee: Employee) => void;
  formatDate: (value: string | null) => string | null;
}) {
  return (
    <div className={`px-4 py-4 space-y-3 ${!employee.isActive ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{employee.displayName}</p>
          <p className="text-xs text-gray-500 truncate">{employee.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RoleBadge role={employee.role} />
          {employee.isActive
            ? <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
            : <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
          }
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{employee.employeeId ?? "—"}</span>
        <span>{employee.department?.name ?? "No dept"}</span>
        <span className="font-semibold text-navy-600">{employee.pointsBalance.toLocaleString()} pts</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {employee.birthday && <span>Birthday: {formatDate(employee.birthday)}</span>}
        {employee.hireDate && <span>Hire: {formatDate(employee.hireDate)}</span>}
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        {isOwnRow ? (
          <span className="text-xs text-gray-500 italic flex-1">Your own role (change from another admin account)</span>
        ) : (
          <RoleSelect
            value={employee.role}
            onChange={(v) => v && onRoleChange(employee.id, v)}
            isSuperAdmin={isSuperAdmin}
            disabled={updatingId === employee.id}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white flex-1"
          />
        )}
        <button
          onClick={() => onEdit(employee)}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          aria-label={`Edit ${employee.displayName}`}
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
