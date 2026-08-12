import type { Employee, Department } from "./types";

export const CATEGORY_BADGE: Record<string, { label: string; style: string }> = {
  PERFORMANCE: { label: "Performance", style: "bg-violet-50 text-violet-700" },
  TEAMWORK:    { label: "Teamwork",    style: "bg-navy-50 text-navy-700" },
  INNOVATION:  { label: "Innovation",  style: "bg-amber-50 text-amber-700" },
  LEADERSHIP:  { label: "Leadership",  style: "bg-emerald-50 text-emerald-700" },
};

export function getDepartmentsFromEmployees(employees: Employee[]): Department[] {
  return Array.from(
    new Map(
      employees
        .filter((e) => e.department)
        .map((e) => [e.department!.id, e.department!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterEmployeesForBulk(
  employees: Employee[],
  currentUserId: string | undefined,
  deptFilter: string,
  selected: Set<string>
) {
  const selectableEmployees = employees.filter((e) => e.id !== currentUserId);
  const filteredForBulk =
    deptFilter === "all"
      ? selectableEmployees
      : selectableEmployees.filter((e) => e.department?.id === deptFilter);
  const allFilteredSelected =
    filteredForBulk.length > 0 && filteredForBulk.every((e) => selected.has(e.id));
  return { selectableEmployees, filteredForBulk, allFilteredSelected };
}

export const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400 bg-white";
export const thClass =
  "text-left px-3.5 py-2.5 font-mono text-[10px] tracking-[0.09em] uppercase text-table-muted first:pl-5 last:pr-5";
export const tdClass = "px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5";
