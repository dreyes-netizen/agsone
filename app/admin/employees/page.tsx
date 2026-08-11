"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { Pagination } from "@/components/ui/pagination";
import { ChevronDown, ChevronUp, Download, Loader2, Upload, UserPlus, Users } from "lucide-react";
import { EmployeeMobileCard } from "@/components/admin/employees/EmployeeMobileCard";
import { EmployeeTableRow } from "@/components/admin/employees/EmployeeTableRow";
import { AddEmployeeModal } from "@/components/admin/employees/AddEmployeeModal";
import { EditEmployeeModal } from "@/components/admin/employees/EditEmployeeModal";
import { useAdminEmployeesActions, EMPTY_ADD_FORM } from "@/lib/hooks/useAdminEmployeesActions";

export default function EmployeesPage() {
  const { dbUser } = useAuth();
  const isSuperAdmin = dbUser?.role === "SUPER_ADMIN";
  const {
    employees,
    totalEmployees,
    page, setPage,
    pages,
    search, setSearch,
    filterDept, setFilterDept,
    filterRole, setFilterRole,
    filterStatus, setFilterStatus,
    loading,
    updatingId,
    syncing,
    syncResult, setSyncResult,
    syncError, setSyncError,
    editingEmployee, setEditingEmployee,
    editForm, setEditForm,
    departments,
    saving,
    showUploadGuide, setShowUploadGuide,
    addModalOpen, setAddModalOpen,
    addForm, setAddForm,
    adding,
    addError, setAddError,
    exporting,
    fileInputRef,
    handleRoleChange,
    handleBootstrap,
    handleSyncFile,
    handleAddEmployee,
    handleEdit,
    handleSave,
    handleExport,
  } = useAdminEmployeesActions();

  // Use departments state for filter dropdown (not derived from paginated employees)
  const deptOptions = departments.map((d) => d.name).sort();

  const hasActiveFilters = filterDept || filterRole || filterStatus;

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
                <li><code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Separation Date</code> — date = inactive, text like &ldquo;N/A&rdquo; = active</li>
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
              onClick={handleExport}
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
              <EmployeeMobileCard
                key={employee.id}
                employee={employee}
                isOwnRow={employee.id === dbUser?.id}
                isSuperAdmin={isSuperAdmin}
                updatingId={updatingId}
                onRoleChange={handleRoleChange}
                onEdit={handleEdit}
                formatDate={formatDate}
              />
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
                <EmployeeTableRow
                  key={employee.id}
                  employee={employee}
                  index={i}
                  isOwnRow={employee.id === dbUser?.id}
                  isSuperAdmin={isSuperAdmin}
                  updatingId={updatingId}
                  onRoleChange={handleRoleChange}
                  onEdit={handleEdit}
                  formatDate={formatDate}
                />
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

      <AddEmployeeModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        departments={departments}
        addForm={addForm}
        setAddForm={setAddForm}
        addError={addError}
        adding={adding}
        isSuperAdmin={isSuperAdmin}
        onSubmit={handleAddEmployee}
      />

      <EditEmployeeModal
        editingEmployee={editingEmployee}
        editForm={editForm}
        setEditForm={setEditForm}
        departments={departments}
        saving={saving}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setEditingEmployee(null)}
        onSave={handleSave}
      />
    </div>
  );
}
