interface EmployeeFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterDept: string;
  onDeptChange: (value: string) => void;
  filterRole: string;
  onRoleChange: (value: string) => void;
  filterStatus: string;
  onStatusChange: (value: string) => void;
  deptOptions: string[];
  isSuperAdmin: boolean;
  onClearFilters: () => void;
}

export function EmployeeFilterBar(props: EmployeeFilterBarProps) {
  const {
    search, onSearchChange, filterDept, onDeptChange, filterRole, onRoleChange,
    filterStatus, onStatusChange, deptOptions, isSuperAdmin, onClearFilters,
  } = props;

  const hasActiveFilters = filterDept || filterRole || filterStatus;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 bg-gray-50 rounded-xl border border-gray-100">
      <input
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 min-w-0 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white"
      />
      <select
        value={filterDept}
        onChange={(e) => onDeptChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
      >
        <option value="">All Departments</option>
        {deptOptions.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select
        value={filterRole}
        onChange={(e) => onRoleChange(e.target.value)}
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
        onChange={(e) => onStatusChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
      >
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="text-xs text-navy-600 hover:text-navy-800 font-medium underline underline-offset-2 whitespace-nowrap"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
