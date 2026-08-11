import { describe, it, expect } from "vitest";
import { requireRole, type AuthUser } from "./requireRole";

function makeUser(role: AuthUser["role"]): AuthUser {
  return {
    id: "user-1",
    firebaseUid: "fb-1",
    email: "person@allianceglobalsolutions.com",
    displayName: "Test Person",
    role,
    departmentId: null,
  };
}

describe("requireRole", () => {
  it("returns false for a null user (unauthenticated)", () => {
    expect(requireRole(null, ["HR_ADMIN", "SUPER_ADMIN"])).toBe(false);
  });

  it("returns true when the user's role is in the allowed list", () => {
    expect(requireRole(makeUser("HR_ADMIN"), ["HR_ADMIN", "SUPER_ADMIN"])).toBe(true);
    expect(requireRole(makeUser("SUPER_ADMIN"), ["HR_ADMIN", "SUPER_ADMIN"])).toBe(true);
  });

  it("returns false when the user's role is not in the allowed list", () => {
    expect(requireRole(makeUser("EMPLOYEE"), ["HR_ADMIN", "SUPER_ADMIN"])).toBe(false);
    expect(requireRole(makeUser("MANAGER"), ["HR_ADMIN", "SUPER_ADMIN"])).toBe(false);
  });

  it("narrows the type at the call site (compile-time check, AGSON-67)", () => {
    const user: AuthUser | null = makeUser("HR_ADMIN");
    if (requireRole(user, ["HR_ADMIN"])) {
      // If this compiles without a `!` or a separate null check, the type
      // predicate is doing its job -- `user.id` is accessible without a cast.
      expect(user.id).toBe("user-1");
    } else {
      throw new Error("expected requireRole to return true");
    }
  });
});
