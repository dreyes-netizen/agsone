import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Employee, EditForm, Department } from "../types";

interface EditEmployeeModalProps {
  employee: Employee | null;
  form: EditForm;
  onFormChange: (updater: (prev: EditForm) => EditForm) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  departments: Department[];
  isSuperAdmin: boolean;
}

export function EditEmployeeModal(props: EditEmployeeModalProps) {
  const { employee, form, onFormChange, saving, onSave, onCancel, departments, isSuperAdmin } = props;

  return (
    <Dialog open={!!employee} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md p-6 space-y-5">
        {employee && (
        <>
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <p className="text-sm text-gray-500 mt-0.5">{employee.email}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Display Name</label>
            <input
              autoFocus
              aria-required="true"
              value={form.displayName}
              onChange={(e) => onFormChange((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
            <input
              type="email"
              aria-required="true"
              value={form.email}
              onChange={(e) => onFormChange((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
            />
          </div>

          {employee.employeeId && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Employee ID</label>
              <p className="px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg text-gray-700">{employee.employeeId}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Department</label>
            <select
              value={form.departmentId ?? ""}
              onChange={(e) => onFormChange((f) => ({ ...f, departmentId: e.target.value || null }))}
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
              value={form.role}
              onChange={(e) => onFormChange((f) => ({ ...f, role: e.target.value as Employee["role"] }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR_ADMIN">HR Admin</option>
              {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              aria-label="Employee active status"
              onClick={() => onFormChange((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Birthday</label>
              <input
                type="date"
                value={form.birthday ?? ""}
                onChange={(e) => onFormChange((f) => ({ ...f, birthday: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hire Date</label>
              <input
                type="date"
                value={form.hireDate ?? ""}
                onChange={(e) => onFormChange((f) => ({ ...f, hireDate: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500/30"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
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
  );
}
