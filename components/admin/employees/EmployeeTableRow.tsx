"use client";

import { Pencil } from "lucide-react";
import { RoleBadge } from "@/components/RoleBadge";
import { RoleSelect } from "@/components/admin/employees/RoleSelect";
import type { Employee } from "@/lib/hooks/useAdminEmployeesActions";

const selectClass =
  "text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white disabled:opacity-50";

export function EmployeeTableRow({
  employee,
  index,
  isOwnRow,
  isSuperAdmin,
  updatingId,
  onRoleChange,
  onEdit,
  formatDate,
}: {
  employee: Employee;
  index: number;
  isOwnRow: boolean;
  isSuperAdmin: boolean;
  updatingId: string | null;
  onRoleChange: (employeeId: string, role: string) => void;
  onEdit: (employee: Employee) => void;
  formatDate: (value: string | null) => string | null;
}) {
  return (
    <tr className={`border-b border-row-border transition-colors hover:bg-row-hover ${index % 2 === 1 ? "bg-row-alt" : ""} ${!employee.isActive ? "opacity-50" : ""}`}>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500 font-mono">{employee.employeeId ?? <span className="text-gray-300">—</span>}</td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 font-medium text-gray-900">{employee.displayName}</td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">{employee.email}</td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
        {employee.department?.name ?? <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
        <span className="font-semibold text-navy-600">
          {employee.pointsBalance.toLocaleString()} pts
        </span>
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
        <RoleBadge role={employee.role} />
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
        {isOwnRow ? (
          <span className="text-xs text-gray-500 italic">Your account</span>
        ) : (
          <RoleSelect
            value={employee.role}
            onChange={(v) => v && onRoleChange(employee.id, v)}
            isSuperAdmin={isSuperAdmin}
            disabled={updatingId === employee.id}
            className={selectClass + " w-36"}
          />
        )}
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
        {employee.isActive
          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
          : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
        }
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
        {formatDate(employee.birthday) ?? <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5 text-gray-500">
        {formatDate(employee.hireDate) ?? <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
        <button
          onClick={() => onEdit(employee)}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          aria-label={`Edit ${employee.displayName}`}
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
