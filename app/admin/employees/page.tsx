"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Pagination } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Download, Loader2, Pencil, Upload, UserPlus, Users } from "lucide-react";
import { RoleBadge } from "@/components/RoleBadge";
import type { Employee, Department, EditForm, AddForm, SyncResult } from "./types";
import { EMPTY_ADD_FORM, getDeptOptions, selectClass, formatDate } from "./utils";
import { SyncBanners } from "./components/SyncBanners";

export default function EmployeesPage() {
  const { apiFetch, streamFetch } = useApiClient();
  const { user, dbUser, loading: authLoading } = useAuth();
  const isSuperAdmin = dbUser?.role === "SUPER_ADMIN";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ displayName: "", email: "", departmentId: null, role: "EMPLOYEE", isActive: true, birthday: null, hireDate: null });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [prevFilters, setPrevFilters] = useState({ search, filterDept, filterRole, filterStatus });
  if (
    search !== prevFilters.search ||
    filterDept !== prevFilters.filterDept ||
    filterRole !== prevFilters.filterRole ||
    filterStatus !== prevFilters.filterStatus
  ) {
    setPrevFilters({ search, filterDept, filterRole, filterStatus });
    setPage(1);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    loadEmployees();
    apiFetch<{ data: Department[] }>("/api/admin/departments")
      .then((res) => setDepartments(res.data))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    loadEmployees();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterDept, filterRole, filterStatus]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("search", search);
      if (filterDept) params.set("department", filterDept);
      if (filterRole) params.set("role", filterRole);
      if (filterStatus) params.set("status", filterStatus);
      const res = await apiFetch<{ data: Employee[]; total: number; pages: number }>(`/api/admin/employees?${params}`);
      setEmployees(res.data);
      setTotalEmployees(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
      toast.error("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleBootstrap() {
    try {
      const res = await apiFetch<{ message: string }>("/api/admin/bootstrap", {
        method: "POST",
      });
      toast.success(res.message);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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
      loadEmployees();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to sync employee list.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");

    if (!addForm.email.endsWith("@allianceglobalsolutions.com")) {
      setAddError("Email must end in @allianceglobalsolutions.com");
      return;
    }

    setAdding(true);
    try {
      const res = await apiFetch<{ data: Employee }>("/api/admin/employees", {
        method: "POST",
        body: JSON.stringify({
          displayName: addForm.displayName.trim(),
          email: addForm.email.trim().toLowerCase(),
          departmentId: addForm.departmentId || null,
          role: addForm.role,
          employeeId: addForm.employeeId.trim() || null,
          hireDate: addForm.hireDate || null,
          birthday: addForm.birthday || null,
        }),
      });
      setEmployees((prev) => [res.data, ...prev]);
      setAddModalOpen(false);
      setAddForm(EMPTY_ADD_FORM);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add employee.");
    } finally {
      setAdding(false);
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
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Use departments state for filter dropdown (not derived from paginated employees)
  const deptOptions = getDeptOptions(departments);

  const hasActiveFilters = filterDept || filterRole || filterStatus;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage roles and view all employee accounts.
        </p>
      </div>

      <SyncBanners
        syncResult={syncResult}
        syncError={syncError}
        onDismissResult={() => setSyncResult(null)}
        onDismissError={() => setSyncError("")}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 bg-gray-50 rounded-xl border border-gray-100">
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white"
        />
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
        >
          <option value="">All Departments</option>
          {deptOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
        >
          <option value="">All Roles</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="HR_ADMIN">HR Admin</option>
          {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterDept(""); setFilterRole(""); setFilterStatus(""); setSearch(""); }}
            className="text-xs text-navy-600 hover:text-navy-800 font-medium underline underline-offset-2 whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleSyncFile}
      />

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        <button
          onClick={() => setShowUploadGuide((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Upload Instructions</span>
          {showUploadGuide ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
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
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Separation Date</code> — date = inactive, text like &quot;N/A&quot; = active</li>
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Email</code> — employee login account</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500">Points, level, role, and profile info are never changed by an upload.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-semibold text-gray-700">
              {employees.length} of {totalEmployees} employees
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => { setAddModalOpen(true); setAddForm(EMPTY_ADD_FORM); setAddError(""); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Add Employee
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-command-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              {syncing ? "Syncing…" : "Upload Employee List"}
            </button>
            <button
              onClick={async () => {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (filterDept) params.set("department", filterDept);
                if (filterRole) params.set("role", filterRole);
                if (filterStatus) params.set("status", filterStatus);
                const qs = params.toString();
                setExporting(true);
                try {
                  const res = await streamFetch(`/api/admin/employees/export${qs ? `?${qs}` : ""}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "employees.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Failed to export employees.");
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span className="text-sm">Loading employees…</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-gray-500">No employees found. You may need to set up the first admin.</p>
            <button
              onClick={handleBootstrap}
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
                    onChange={(e) => e.target.value && handleRoleChange(employee.id, e.target.value)}
                    disabled={updatingId === employee.id}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white flex-1"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR_ADMIN">HR Admin</option>
                    {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                  </select>
                  <button
                    onClick={() => handleEdit(employee)}
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
                      onChange={(e) => e.target.value && handleRoleChange(employee.id, e.target.value)}
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
                      onClick={() => handleEdit(employee)}
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
            <Pagination page={page} pages={pages} total={totalEmployees} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader className="mb-5">
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  required
                  autoFocus
                  aria-required="true"
                  type="text"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Email <span className="text-red-500">*</span></label>
                <input
                  required
                  aria-required="true"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="j.delacruz@allianceglobalsolutions.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={addForm.departmentId}
                    onChange={(e) => setAddForm((f) => ({ ...f, departmentId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR_ADMIN">HR Admin</option>
                    {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={addForm.employeeId}
                  onChange={(e) => setAddForm((f) => ({ ...f, employeeId: e.target.value }))}
                  placeholder="e.g. EMP-001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                  <input
                    type="date"
                    value={addForm.hireDate}
                    onChange={(e) => setAddForm((f) => ({ ...f, hireDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                  <input
                    type="date"
                    value={addForm.birthday}
                    onChange={(e) => setAddForm((f) => ({ ...f, birthday: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  />
                </div>
              </div>

              {addError && <p className="text-red-500 text-sm">{addError}</p>}

              <button
                type="submit"
                disabled={adding || !addForm.displayName.trim() || !addForm.email.trim()}
                className="w-full bg-navy-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
              >
                {adding ? "Adding…" : "Add Employee"}
              </button>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEmployee} onOpenChange={(open) => { if (!open) setEditingEmployee(null); }}>
        <DialogContent className="max-w-md p-6 space-y-5">
          {editingEmployee && (
            <>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
              <p className="text-sm text-gray-500 mt-0.5">{editingEmployee.email}</p>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Display Name</label>
                <input
                  autoFocus
                  aria-required="true"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  aria-required="true"
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
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editForm.isActive}
                  aria-label="Employee active status"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-command-black rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
