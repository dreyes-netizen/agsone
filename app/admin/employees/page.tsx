"use client";

import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { toast } from "sonner";
import type { Employee, Department, EditForm, AddForm, SyncResult } from "./types";
import { EMPTY_ADD_FORM, getDeptOptions } from "./utils";
import { SyncBanners } from "./components/SyncBanners";
import { EmployeeFilterBar } from "./components/EmployeeFilterBar";
import { EmployeeToolbar } from "./components/EmployeeToolbar";
import { EmployeeTable } from "./components/EmployeeTable";
import { AddEmployeeModal } from "./components/AddEmployeeModal";
import { EditEmployeeModal } from "./components/EditEmployeeModal";

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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
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

  async function handleExport() {
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
  }

  // Use departments state for filter dropdown (not derived from paginated employees)
  const deptOptions = getDeptOptions(departments);

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

      <EmployeeFilterBar
        search={search}
        onSearchChange={setSearch}
        filterDept={filterDept}
        onDeptChange={setFilterDept}
        filterRole={filterRole}
        onRoleChange={setFilterRole}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        deptOptions={deptOptions}
        isSuperAdmin={isSuperAdmin}
        onClearFilters={() => { setSearch(""); setFilterDept(""); setFilterRole(""); setFilterStatus(""); }}
      />

      <div className="bg-white rounded-card border border-table-border overflow-clip">
        <EmployeeToolbar
          employeeCount={employees.length}
          totalEmployees={totalEmployees}
          syncing={syncing}
          exporting={exporting}
          fileInputRef={fileInputRef}
          onAddClick={() => { setAddModalOpen(true); setAddForm(EMPTY_ADD_FORM); setAddError(""); }}
          onUploadClick={() => fileInputRef.current?.click()}
          onFileSelected={handleSyncFile}
          onExportClick={handleExport}
        />

        <EmployeeTable
          employees={employees}
          loading={loading}
          isSuperAdmin={isSuperAdmin}
          currentUserId={dbUser?.id}
          updatingId={updatingId}
          page={page}
          pages={pages}
          totalEmployees={totalEmployees}
          onPageChange={setPage}
          onRoleChange={handleRoleChange}
          onEdit={handleEdit}
          onBootstrap={handleBootstrap}
        />
      </div>

      <AddEmployeeModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        form={addForm}
        onFormChange={setAddForm}
        error={addError}
        submitting={adding}
        onSubmit={handleAddEmployee}
        departments={departments}
        isSuperAdmin={isSuperAdmin}
      />

      <EditEmployeeModal
        employee={editingEmployee}
        form={editForm}
        onFormChange={setEditForm}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setEditingEmployee(null)}
        departments={departments}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
