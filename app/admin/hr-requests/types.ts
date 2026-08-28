/** One row from GET /api/admin/hr-requests. */
export type AdminHrRequest = {
  id: string;
  clientRef: string;
  categoryId: string;
  typeId: string;
  tag: string;
  subject: string;
  body: string;
  fields: Record<string, string>;
  notes: string | null;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  adminNote: string | null;
  createdAt: string;
  handledAt: string | null;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    email: string;
    employeeId: string | null;
    department: { name: string } | null;
  };
  handledBy: { id: string; displayName: string } | null;
};
