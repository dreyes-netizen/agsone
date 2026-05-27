"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Upload } from "lucide-react";

type Employee = {
  id: string;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  pointsBalance: number;
  isActive: boolean;
  hireDate: string | null;
  department: { id: string; name: string } | null;
};

type Department = {
  id: string;
  name: string;
};

const roleLabel = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Admin",
};

const roleBadgeClass = {
  EMPLOYEE: "bg-gray-100 text-gray-600",
  MANAGER: "bg-navy-100 text-navy-700",
  HR_ADMIN: "bg-violet-100 text-violet-700",
};

export default function EmployeesPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingDeptId, setUpdatingDeptId] = useState<string | null>(null);
  const [updatingHireDateId, setUpdatingHireDateId] = useState<string | null>(null);
  const [hireDateEdits, setHireDateEdits] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ deactivated: number; reactivated: number; imported: number } | null>(null);
  const [syncError, setSyncError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([
      apiFetch<{ data: Employee[] }>("/api/admin/employees"),
      apiFetch<{ data: Department[] }>("/api/departments"),
    ])
      .then(([empRes, deptRes]) => {
        setEmployees(empRes.data);
        setDepartments(deptRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function handleRoleChange(employeeId: string, role: string) {
    setUpdatingId(employeeId);
    try {
      await apiFetch(`/api/admin/users/${employeeId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId ? { ...e, role: role as Employee["role"] } : e
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDepartmentChange(employeeId: string, departmentId: string) {
    setUpdatingDeptId(employeeId);
    try {
      const value = departmentId === "__none__" ? null : departmentId;
      await apiFetch(`/api/admin/users/${employeeId}/department`, {
        method: "PATCH",
        body: JSON.stringify({ departmentId: value }),
      });
      const dept = departments.find((d) => d.id === value) ?? null;
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? { ...e, department: dept ? { id: dept.id, name: dept.name } : null }
            : e
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update department");
    } finally {
      setUpdatingDeptId(null);
    }
  }

  async function handleHireDateSave(employeeId: string) {
    const value = hireDateEdits[employeeId];
    if (value === undefined) return;
    setUpdatingHireDateId(employeeId);
    try {
      await apiFetch(`/api/admin/employees/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ hireDate: value || null }),
      });
      setEmployees((prev) =>
        prev.map((e) => (e.id === employeeId ? { ...e, hireDate: value || null } : e))
      );
      setHireDateEdits((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    } catch {
      alert("Failed to update hire date");
    } finally {
      setUpdatingHireDateId(null);
    }
  }

  async function handleBootstrap() {
    try {
      const res = await apiFetch<{ message: string }>("/api/admin/bootstrap", {
        method: "POST",
      });
      alert(res.message);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleSyncFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<{ data: { deactivated: number; reactivated: number; imported: number } }>(
        "/api/admin/employees/sync",
        { method: "POST", body: form }
      );
      setSyncResult(res.data);
      // Refresh employee list to reflect changes
      const empRes = await apiFetch<{ data: Employee[] }>("/api/admin/employees");
      setEmployees(empRes.data);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to sync employee list.");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = employees.filter(
    (e) =>
      e.displayName.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectClass =
    "text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage roles and view all employee accounts.
        </p>
      </div>

      {syncResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
          <span>
            Sync complete —{" "}
            {syncResult.imported > 0 && <><strong>{syncResult.imported}</strong> new account{syncResult.imported !== 1 ? "s" : ""} created, </>}
            <strong>{syncResult.deactivated}</strong> deactivated
            {syncResult.reactivated > 0 && <>, <strong>{syncResult.reactivated}</strong> reactivated</>}.
          </span>
          <button onClick={() => setSyncResult(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Dismiss</button>
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{syncError}</span>
          <button onClick={() => setSyncError("")} className="text-red-500 hover:text-red-700 text-xs font-medium">Dismiss</button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleSyncFile}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">
            {employees.length} total employees
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[#111827] text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {syncing ? "Syncing…" : "Upload Employee List"}
            </button>
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-gray-400">No employees found. You may need to set up the first admin.</p>
            <button
              onClick={handleBootstrap}
              className="bg-[#111827] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800"
            >
              Make me HR Admin
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hire Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{employee.displayName}</td>
                  <td className="px-6 py-3 text-gray-500">{employee.email}</td>
                  <td className="px-6 py-3">
                    <select
                      value={employee.department?.id ?? "__none__"}
                      onChange={(e) => e.target.value && handleDepartmentChange(employee.id, e.target.value)}
                      disabled={updatingDeptId === employee.id}
                      className={selectClass + " w-40"}
                    >
                      <option value="__none__">No department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-semibold text-navy-600">
                      {employee.pointsBalance.toLocaleString()} pts
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeClass[employee.role]}`}>
                      {roleLabel[employee.role]}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={employee.role}
                      onChange={(e) => e.target.value && handleRoleChange(employee.id, e.target.value)}
                      disabled={updatingId === employee.id}
                      className={selectClass + " w-36"}
                    >
                      <option value="EMPLOYEE">Employee</option>
                      <option value="MANAGER">Manager</option>
                      <option value="HR_ADMIN">HR Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={hireDateEdits[employee.id] ?? (employee.hireDate ? employee.hireDate.slice(0, 10) : "")}
                        onChange={(e) => setHireDateEdits((prev) => ({ ...prev, [employee.id]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                      />
                      {hireDateEdits[employee.id] !== undefined && (
                        <button
                          onClick={() => handleHireDateSave(employee.id)}
                          disabled={updatingHireDateId === employee.id}
                          className="text-xs bg-[#111827] text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                        >
                          {updatingHireDateId === employee.id ? "…" : "Save"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
