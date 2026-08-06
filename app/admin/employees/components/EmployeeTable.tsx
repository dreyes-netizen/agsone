import { Loader2, Pencil, Users } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { RoleBadge } from "@/components/RoleBadge";
import type { Employee } from "../types";
import { formatDate, selectClass } from "../utils";

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  isSuperAdmin: boolean;
  updatingId: string | null;
  page: number;
  pages: number;
  totalEmployees: number;
  onPageChange: (page: number) => void;
  onRoleChange: (employeeId: string, role: Employee["role"]) => void;
  onEdit: (employee: Employee) => void;
  onBootstrap: () => void;
}

export function EmployeeTable(props: EmployeeTableProps) {
  const { employees, loading, isSuperAdmin, updatingId, page, pages, totalEmployees, onPageChange, onRoleChange, onEdit, onBootstrap } = props;

  return (
    <>
      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">Loading employees…</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-gray-500">No employees found. You may need to set up the first admin.</p>
          <button
            onClick={onBootstrap}
            className="bg-command-black text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800"
          >
            Make me HR Admin
          </button>
        </div>
      ) : (
        <>
        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-gray-50">
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-8">
              <Users className="w-8 h-8 text-gray-300" aria-hidden="true" />
              <p className="text-gray-500 text-sm">No employees match the current filters.</p>
            </div>
          ) : employees.map((employee) => (
            <div key={employee.id} className={`px-4 py-4 space-y-3 ${!employee.isActive ? "opacity-50" : ""}`}>
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
                <select
                  value={employee.role}
                  onChange={(e) => e.target.value && onRoleChange(employee.id, e.target.value as Employee["role"])}
                  disabled={updatingId === employee.id}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white flex-1"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                  {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
                <button
                  onClick={() => onEdit(employee)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
                  aria-label={`Edit ${employee.displayName}`}
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block overflow-auto max-h-[70vh] scroll-hint">
        <table className="w-full border-collapse" aria-label="Employee list">
          <thead className="sticky top-0 z-10 bg-table-head">
            <tr className="border-b border-table-border">
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Emp ID</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Name</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Email</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Department</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Points</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Role</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Change Role</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Status</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Birthday</th>
              <th scope="col" className="text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5">Hire Date</th>
              <th scope="col" className="px-3.5 py-2.5 last:pr-5" />
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-gray-300" aria-hidden="true" />
                    <p className="text-table-muted text-[13px]">No employees match the current filters.</p>
                  </div>
                </td>
              </tr>
            ) : employees.map((employee, i) => (
              <tr key={employee.id} className={`border-b border-row-border transition-colors hover:bg-row-hover ${i % 2 === 1 ? "bg-row-alt" : ""} ${!employee.isActive ? "opacity-50" : ""}`}>
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
                  <select
                    value={employee.role}
                    onChange={(e) => e.target.value && onRoleChange(employee.id, e.target.value as Employee["role"])}
                    disabled={updatingId === employee.id}
                    className={selectClass + " w-36"}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR_ADMIN">HR Admin</option>
                    {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                  </select>
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
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}

      {!loading && employees.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <Pagination page={page} pages={pages} total={totalEmployees} onPageChange={onPageChange} />
        </div>
      )}
    </>
  );
}
