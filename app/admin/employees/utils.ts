import type { AddForm, Department } from "./types";

export const EMPTY_ADD_FORM: AddForm = {
  displayName: "",
  email: "",
  departmentId: "",
  role: "EMPLOYEE",
  employeeId: "",
  hireDate: "",
  birthday: "",
};

export function getDeptOptions(departments: Department[]): string[] {
  return departments.map((d) => d.name).sort();
}

export const selectClass =
  "text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 bg-white disabled:opacity-50";

export function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;
}
