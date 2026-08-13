export type Department = { id: string; name: string };

export type Employee = {
  id: string;
  displayName: string;
  email: string;
  pointsBalance: number;
  department?: { id: string; name: string } | null;
};

export type Transaction = {
  id: string;
  amount: number;
  note: string | null;
  category: string | null;
  createdAt: string;
  toUser?: { displayName: string };
  fromUser: { displayName: string } | null;
};

export type Budget = { isExempt: boolean; used: number; remaining: number; total: number };

export type AttendanceResult = {
  awarded: number;
  awardedNames?: string[];
  skipped: { notFound: string[]; alreadyAwarded: string[] };
};

export type EmployeePickerResponse = { data: (Employee & { role: string })[] };
