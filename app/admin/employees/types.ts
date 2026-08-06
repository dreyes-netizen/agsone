export type Employee = {
  id: string;
  employeeId: string | null;
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN";
  pointsBalance: number;
  isActive: boolean;
  hireDate: string | null;
  birthday: string | null;
  department: { id: string; name: string } | null;
};

export type Department = { id: string; name: string };

export type EditForm = {
  displayName: string;
  email: string;
  departmentId: string | null;
  role: Employee["role"];
  isActive: boolean;
  birthday: string | null;
  hireDate: string | null;
};

export type AddForm = {
  displayName: string;
  email: string;
  departmentId: string;
  role: Employee["role"];
  employeeId: string;
  hireDate: string;
  birthday: string;
};

export type SyncResult = {
  deactivated: number;
  reactivated: number;
  imported: number;
  birthdaysUpdated: number;
  activeInFile: number;
  resignedInFile: number;
  failedImports: number;
  failedEmails: string[];
};
