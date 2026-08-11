"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoleSelect } from "@/components/admin/employees/RoleSelect";
import type { AddForm, Department, Employee } from "@/lib/hooks/useAdminEmployeesActions";

export function AddEmployeeModal({
  open,
  onOpenChange,
  departments,
  addForm,
  setAddForm,
  addError,
  adding,
  isSuperAdmin,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  addForm: AddForm;
  setAddForm: React.Dispatch<React.SetStateAction<AddForm>>;
  addError: string;
  adding: boolean;
  isSuperAdmin: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="mb-5">
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
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
                <RoleSelect
                  value={addForm.role}
                  onChange={(v) => setAddForm((f) => ({ ...f, role: v as Employee["role"] }))}
                  isSuperAdmin={isSuperAdmin}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
                />
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
  );
}
