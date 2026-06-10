"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ChevronDown, ChevronUp, Pencil, Upload, X } from "lucide-react";

type Employee = {
  id: string;
  employeeId: string | null;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN";
  pointsBalance: number;
  isActive: boolean;
  hireDate: string | null;
  birthday: string | null;
  department: { id: string; name: string } | null;
};

type Department = { id: string; name: string };

type EditForm = {
  displayName: string;
  email: string;
  departmentId: string | null;
  role: Employee["role"];
  isActive: boolean;
  birthday: string | null;
  hireDate: string | null;
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
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ deactivated: number; reactivated: number; imported: number; birthdaysUpdated: number; activeInFile: number; resignedInFile: number; failedImports: number; failedEmails: string[] } | null>(null);
  const [syncError, setSyncError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ displayName: "", email: "", departmentId: null, role: "EMPLOYEE", isActive: true, birthday: null, hireDate: null });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [showUploadGuide, setShowUploadGuide] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Employee[] }>("/api/admin/employees")
      .then((res) => setEmployees(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    apiFetch<{ data: Department[] }>("/api/admin/departments")
      .then((res) => setDepartments(res.data))
      .catch(console.error);
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
      const res = await apiFetch<{ data: { deactivated: number; reactivated: number; imported: number; birthdaysUpdated: number; activeInFile: number; resignedInFile: number; failedImports: number; failedEmails: string[] } }>(
        "/api/admin/employees/sync",
        { method: "POST", body: form }
      );
      setSyncResult(res.data);
      const empRes = await apiFetch<{ data: Employee[] }>("/api/admin/employees");
      setEmployees(empRes.data);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to sync employee list.");
    } finally {
      setSyncing(false);
    }
  }

  function handleEdit(employee: Employee) {
    setEditingEmployee(employee);
    setEditForm({
      displayName: employee.displayName,
      email: employee.email,
      departmentId: employee.department?.id ?? null,
      role: employee.role,
      isActive: employee.isActive,
      birthday: employee.birthday ? employee.birthday.slice(0, 10) : null,
      hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : null,
    });
  }

  async function handleSave() {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/employees/${editingEmployee.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: editForm.displayName,
          email: editForm.email,
          departmentId: editForm.departmentId,
          role: editForm.role,
          isActive: editForm.isActive,
          birthday: editForm.birthday || null,
          hireDate: editForm.hireDate || null,
        }),
      });
      const found = departments.find((d) => d.id === editForm.departmentId);
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmployee.id
            ? {
                ...e,
                displayName: editForm.displayName,
                email: editForm.email,
                department: found ? { id: found.id, name: found.name } : null,
                role: editForm.role,
                isActive: editForm.isActive,
                birthday: editForm.birthday,
                hireDate: editForm.hireDate,
              }
            : e
        )
      );
      setEditingEmployee(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Unique department names for the department filter dropdown
  const deptOptions = Array.from(
    new Set(employees.map((e) => e.department?.name).filter(Boolean))
  ).sort() as string[];

  const filtered = employees.filter((e) => {
    if (search && !e.displayName.toLowerCase().includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDept && (e.department?.name ?? "") !== filterDept) return false;
    if (filterRole && e.role !== filterRole) return false;
    if (filterStatus === "active" && !e.isActive) return false;
    if (filterStatus === "inactive" && e.isActive) return false;
    return true;
  });

  const hasActiveFilters = filterDept || filterRole || filterStatus;

  const selectClass =
    "text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white disabled:opacity-50";

  const filterSelectClass =
    "text-xs border-0 bg-transparent font-semibold text-gray-500 uppercase tracking-wide focus:outline-none cursor-pointer pr-1 appearance-none";

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage roles and view all employee accounts.
        </p>
      </div>

      {syncResult && (
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
            <span>
              Sync complete — <strong>{syncResult.activeInFile}</strong> active, <strong>{syncResult.resignedInFile}</strong> resigned in file.{" "}
              {syncResult.imported > 0 && <><strong>{syncResult.imported}</strong> new account{syncResult.imported !== 1 ? "s" : ""} created, </>}
              <strong>{syncResult.deactivated}</strong> deactivated
              {syncResult.reactivated > 0 && <>, <strong>{syncResult.reactivated}</strong> reactivated</>}
              {syncResult.birthdaysUpdated > 0 && <>, <strong>{syncResult.birthdaysUpdated}</strong> birthday{syncResult.birthdaysUpdated !== 1 ? "s" : ""} updated</>}.
            </span>
            <button onClick={() => setSyncResult(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Dismiss</button>
          </div>
          {syncResult.failedImports > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">{syncResult.failedImports} employee{syncResult.failedImports !== 1 ? "s" : ""} could not be imported (already exist with a different email format):</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs font-mono">
                {syncResult.failedEmails.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
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
        <button
          onClick={() => setShowUploadGuide((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Upload Instructions</span>
          {showUploadGuide ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showUploadGuide && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 text-sm space-y-3">
            <p className="text-gray-600">Upload an <strong>.xlsx</strong> file exported from Sprout HR. Column names must match exactly.</p>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Required Columns</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-700">
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Employee ID</code> — matches existing employees</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Last Name</code> — display name</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Middle Name</code> — display name</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">First Name</code> — display name</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Birthday</code> — used for birthday rewards</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Department</code> — auto-created if new</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Immediate Supervisor</code></li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Hire Date</code> — used for anniversary rewards</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Separation Date</code> — date = inactive, text like "N/A" = active</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Email</code> — employee login account</li>
              </ul>
            </div>
            <p className="text-xs text-gray-400">Points, level, role, and profile info are never changed by an upload.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-semibold text-gray-700">
              {filtered.length} of {employees.length} employees
            </span>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterDept(""); setFilterRole(""); setFilterStatus(""); }}
                className="text-xs text-navy-600 hover:text-navy-800 font-medium underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
              className="w-full sm:w-64 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white"
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
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emp ID</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3">
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    className={filterSelectClass + (filterDept ? " text-navy-600" : "")}
                  >
                    <option value="">Department ▾</option>
                    {deptOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                <th className="text-left px-6 py-3">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className={filterSelectClass + (filterRole ? " text-navy-600" : "")}
                  >
                    <option value="">Role ▾</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR_ADMIN">HR Admin</option>
                  </select>
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Role</th>
                <th className="text-left px-6 py-3">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={filterSelectClass + (filterStatus ? " text-navy-600" : "")}
                  >
                    <option value="">Status ▾</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Birthday</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hire Date</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-400 text-sm">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : filtered.map((employee) => (
                <tr key={employee.id} className={`hover:bg-gray-50/60 transition-colors border-b border-gray-50 ${!employee.isActive ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{employee.employeeId ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{employee.displayName}</td>
                  <td className="px-6 py-3 text-gray-500">{employee.email}</td>
                  <td className="px-6 py-3 text-gray-500 text-sm">
                    {employee.department?.name ?? <span className="text-gray-300">—</span>}
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
                  <td className="px-6 py-3 text-gray-500 text-sm">
                    {employee.isActive
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                    }
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-sm">
                    {formatDate(employee.birthday) ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-sm">
                    {formatDate(employee.hireDate) ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit employee"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Employee</h2>
                <p className="text-sm text-gray-500 mt-0.5">{editingEmployee.email}</p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Display Name</label>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              {editingEmployee.employeeId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee ID</label>
                  <p className="px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg text-gray-700">{editingEmployee.employeeId}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Department</label>
                <select
                  value={editForm.departmentId ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, departmentId: e.target.value || null }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                >
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Birthday</label>
                  <input
                    type="date"
                    value={editForm.birthday ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, birthday: e.target.value || null }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hire Date</label>
                  <input
                    type="date"
                    value={editForm.hireDate ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, hireDate: e.target.value || null }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-[#111827] rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
