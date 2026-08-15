import { describe, it, expect } from "vitest";
import { postVisibilityWhere } from "./postVisibility";

describe("postVisibilityWhere", () => {
  it("gives HR_ADMIN an unrestricted where clause", () => {
    expect(postVisibilityWhere({ role: "HR_ADMIN", departmentId: "dept-1" })).toEqual({});
  });

  it("gives SUPER_ADMIN an unrestricted where clause too", () => {
    // Regression: SUPER_ADMIN used to fall through to the department scope,
    // unlike every other permission check in the codebase.
    expect(postVisibilityWhere({ role: "SUPER_ADMIN", departmentId: "dept-1" })).toEqual({});
  });

  it("scopes non-admins to company-wide posts plus their own department", () => {
    const where = postVisibilityWhere({ role: "EMPLOYEE", departmentId: "dept-1" });
    expect(where).toEqual({ OR: [{ departmentId: null }, { departmentId: "dept-1" }] });
  });

  it("still scopes a manager with no department to company-wide posts only", () => {
    const where = postVisibilityWhere({ role: "MANAGER", departmentId: null });
    expect(where).toEqual({ OR: [{ departmentId: null }, { departmentId: null }] });
  });
});
