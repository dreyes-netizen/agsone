import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AddForm, Department, Employee } from "../types";

interface AddEmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AddForm;
  onFormChange: (updater: (prev: AddForm) => AddForm) => void;
  error: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  departments: Department[];
  isSuperAdmin: boolean;
}

export function AddEmployeeModal(props: AddEmployeeModalProps) {
  const { open, onOpenChange, form, onFormChange, error, submitting, onSubmit, departments, isSuperAdmin } = props;

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
                value={form.displayName}
                onChange={(e) => onFormChange((f) => ({ ...f, displayName: e.target.value }))}
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
                value={form.email}
                onChange={(e) => onFormChange((f) => ({ ...f, email: e.target.value }))}
                placeholder="j.delacruz@allianceglobalsolutions.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => onFormChange((f) => ({ ...f, departmentId: e.target.value }))}
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
                  value={form.role}
                  onChange={(e) => onFormChange((f) => ({ ...f, role: e.target.value as Employee["role"] }))}
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
                value={form.employeeId}
                onChange={(e) => onFormChange((f) => ({ ...f, employeeId: e.target.value }))}
                placeholder="e.g. EMP-001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                <input
                  type="date"
                  value={form.hireDate}
                  onChange={(e) => onFormChange((f) => ({ ...f, hireDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => onFormChange((f) => ({ ...f, birthday: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !form.displayName.trim() || !form.email.trim()}
              className="w-full bg-navy-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              {submitting ? "Adding…" : "Add Employee"}
            </button>
          </form>
      </DialogContent>
    </Dialog>
  );
}
