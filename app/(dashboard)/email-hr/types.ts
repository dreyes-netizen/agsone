/** One row from GET /api/hr-requests — the employee's own filed requests. */
export type MyHrRequest = {
  id: string;
  clientRef: string;
  categoryId: string;
  typeId: string;
  tag: string;
  subject: string;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  createdAt: string;
  handledAt: string | null;
  adminNote: string | null;
};
